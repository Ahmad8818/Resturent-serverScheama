import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import TableBookingModel from '../models/TableBooking';
import {
    findAvailableTables,
    getAvailableTimeSlots,
    getAvailabilityDetails,
    createBookingWithValidation,
} from '../services/bookingService';
import { enforceBranchScope } from '../utils/security';

// ─── GET /api/bookings/available ───────────────────────────────────────────────
export const getAvailableBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { date, time, guests, duration } = req.query;

    if (!date || !guests) {
        return next(new AppError('Missing required query parameters: date, guests', 400));
    }

    const branchId = req.branchId as string;

    const bookingDate = new Date(date as string);
    bookingDate.setHours(0, 0, 0, 0);

    const guestCount = Math.max(1, parseInt(guests as string));
    const durationMins = Math.max(30, parseInt(duration as string) || 60);
    const timeStr = (time as string) || '18:00';

    try {
        const availability = await getAvailabilityDetails(
            branchId as string,
            bookingDate,
            timeStr,
            guestCount,
            durationMins,
        );

        res.status(200).json({
            success: true,
            data: availability,
        });
    } catch (error: any) {
        next(error);
    }
});

// ─── GET /api/bookings/time-slots ──────────────────────────────────────────────
export const getTimeSlots = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { date, guests, duration } = req.query;

    if (!date || !guests) {
        return next(new AppError('Missing required query parameters: date, guests', 400));
    }

    const branchId = req.branchId as string;

    const bookingDate = new Date(date as string);
    bookingDate.setHours(0, 0, 0, 0);

    const guestCount = Math.max(1, parseInt(guests as string));
    const durationMins = Math.max(30, parseInt(duration as string) || 60);

    try {
        const timeSlots = await getAvailableTimeSlots(branchId as string, bookingDate, guestCount, 30, durationMins);

        res.status(200).json({
            success: true,
            data: {
                slots: timeSlots,
                hasAvailableSlots: timeSlots.length > 0,
            },
        });
    } catch (error: any) {
        next(error);
    }
});

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
export const getBookingById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const booking = await TableBookingModel.findById(req.params.id)
        .populate('table')
        .populate('branchId');

    if (!booking) {
        return next(new AppError('Booking not found.', 404));
    }

    // Check access: only the user who made the booking or admin can view
    if (req.user?._id?.toString() !== booking.user?.toString() && req.user?.role !== 'admin') {
        return next(new AppError('You do not have permission to view this booking.', 403));
    }

    res.status(200).json({
        success: true,
        data: booking,
    });
});

// ─── POST /api/bookings ────────────────────────────────────────────────────────
export const createBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, phone, date, time, guests, tableId, tableType, specialRequest, duration } = req.body;
    const branchId = req.branchId as string;

    try {
        const bookingDate = new Date(date);
        bookingDate.setHours(0, 0, 0, 0);

        const booking = await createBookingWithValidation({
            branchId,
            name,
            email,
            phone,
            date: bookingDate,
            time,
            guests,
            tableId,
            tableType,
            duration: duration || 60,
            specialRequest,
            userId: req.user?._id?.toString(),
        });

        res.status(201).json({
            success: true,
            message: 'Table reservation created! We will confirm shortly.',
            data: booking,
        });
    } catch (error: any) {
        next(error);
    }
});

// ─── PATCH /api/bookings/:id (edit booking) ────────────────────────────────────
export const editBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { date, time, guests, tableId, specialRequest, duration } = req.body;
    const bookingId = req.params.id;

    // Get existing booking
    const booking = await TableBookingModel.findById(bookingId);
    if (!booking) {
        return next(new AppError('Booking not found.', 404));
    }

    // Check access: only the user who made the booking can edit (before confirmed)
    if (booking.user?.toString() !== req.user?._id?.toString() && req.user?.role !== 'admin') {
        return next(new AppError('You do not have permission to edit this booking.', 403));
    }

    // Prevent editing confirmed/completed bookings (admin can override)
    if (['confirmed', 'completed'].includes(booking.status) && req.user?.role !== 'admin') {
        return next(new AppError(`Cannot edit a ${booking.status} booking.`, 400));
    }

    // If trying to change date/time, validate availability
    if ((date && date !== booking.date.toISOString()) || (time && time !== booking.time)) {
        const newDate = date ? new Date(date) : booking.date;
        newDate.setHours(0, 0, 0, 0);
        const newTime = time || booking.time;
        const newDuration = duration || booking.duration;
        const newGuests = guests || booking.guests;

        try {
            const availability = await getAvailabilityDetails(
                booking.branchId.toString(),
                newDate,
                newTime,
                newGuests,
                newDuration,
            );

            if (!availability.canBook) {
                return next(new AppError('No tables available for the new date/time.', 400));
            }
        } catch (error: any) {
            return next(error);
        }
    }

    // Update booking fields
    if (date) booking.date = new Date(date);
    if (time) booking.time = time;
    if (guests) booking.guests = guests;
    if (specialRequest !== undefined) booking.specialRequest = specialRequest;
    if (duration) booking.duration = duration;

    const updatedBooking = await booking.save();

    res.status(200).json({
        success: true,
        message: 'Booking updated successfully.',
        data: updatedBooking,
    });
});

// ─── GET /api/bookings/my-bookings ────────────────────────────────────────────
export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const status = req.query.status as string | undefined;

    const query: any = { user: req.user?._id };
    if (status) {
        query.status = status;
    }

    const [total, bookings] = await Promise.all([
        TableBookingModel.countDocuments(query),
        TableBookingModel.find(query)
            .populate('table')
            .populate('branchId')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
    ]);

    res.status(200).json({
        success: true,
        message: 'My bookings fetched successfully.',
        data: {
            bookings,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        },
    });
});

// ─── GET /api/bookings (admin) ────────────────────────────────────────────────
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const status = req.query.status as string | undefined;
    const branchId = req.branchId;

    let query: any = {};
    if (status) {
        query.status = status;
    }
    
    // Apply strict role-based branch scoping
    query = enforceBranchScope(query, req.user);

    const [total, bookings] = await Promise.all([
        TableBookingModel.countDocuments(query),
        TableBookingModel.find(query)
            .populate('user', 'name email phone')
            .populate('table')
            .populate('branchId')
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
    ]);

    res.status(200).json({
        success: true,
        message: 'All bookings fetched successfully.',
        data: {
            bookings,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        },
    });
});

// ─── PATCH /api/bookings/:id/status (admin) ───────────────────────────────────
export const updateBookingStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return next(new AppError(`Invalid status. Valid values: ${validStatuses.join(', ')}`, 400));
    }

    const booking = await TableBookingModel.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true },
    ).populate('table').populate('branchId');

    if (!booking) return next(new AppError('Booking not found.', 404));

    res.status(200).json({
        success: true,
        message: 'Booking status updated successfully.',
        data: booking,
    });
});

// ─── DELETE /api/bookings/:id (admin) ────────────────────────────────────────
export const deleteBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const booking = await TableBookingModel.findByIdAndDelete(req.params.id);
    if (!booking) return next(new AppError('Booking not found.', 404));
    res.status(200).json({
        success: true,
        message: 'Booking deleted successfully.',
        data: null,
    });
});
