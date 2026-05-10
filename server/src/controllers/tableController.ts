import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../utils/asyncHandler';
import AppError from '../utils/AppError';
import TableModel from '../models/Table';
import TableBookingModel from '../models/TableBooking';

// ─── GET /api/tables ───────────────────────────────────────────────────────────
export const getAllTables = asyncHandler(async (_req: Request, res: Response) => {
    const tables = await TableModel.find().sort({ tableNumber: 1 });
    res.status(200).json({
        success: true,
        data: tables,
    });
});

// ─── POST /api/tables (admin) ──────────────────────────────────────────────────
export const createTable = asyncHandler(async (req: Request, res: Response) => {
    const { tableNumber, capacity, type } = req.body;

    const existing = await TableModel.findOne({ tableNumber });
    if (existing) {
        throw new AppError(`Table number ${tableNumber} already exists.`, 400);
    }

    const table = await TableModel.create({ tableNumber, capacity, type });

    res.status(201).json({
        success: true,
        message: 'Table created successfully.',
        data: table,
    });
});

// ─── PATCH /api/tables/:id (admin) ─────────────────────────────────────────────
export const updateTable = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const table = await TableModel.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!table) return next(new AppError('Table not found.', 404));

    res.status(200).json({
        success: true,
        message: 'Table updated successfully.',
        data: table,
    });
});

// ─── DELETE /api/tables/:id (admin) ────────────────────────────────────────────
export const deleteTable = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const table = await TableModel.findByIdAndDelete(req.params.id);
    if (!table) return next(new AppError('Table not found.', 404));

    res.status(200).json({
        success: true,
        message: 'Table deleted successfully.',
    });
});

// ─── GET /api/tables/status ─────────────────────────────────────────────────────
// Returns tables with their status (Available, Booked) for a given date/time
export const getTablesWithStatus = asyncHandler(async (req: Request, res: Response) => {
    const { date, startTime, duration } = req.query; // date format: YYYY-MM-DD, startTime: HH:mm, duration: minutes
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const tables = await TableModel.find({ isActive: true }).sort({ tableNumber: 1 });
    
    // Fetch all confirmed/pending bookings for this date
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const bookings = await TableBookingModel.find({
        date: { $gte: targetDate, $lte: dayEnd },
        status: { $in: ['confirmed', 'pending'] }
    });

    const result = tables.map(table => {
        const tableBookings = bookings.filter(b => b.table?.toString() === table._id.toString());
        
        let status = 'available';

        if (startTime) {
            // If startTime is provided, check for overlapping bookings
            const reqStart = new Date(`${date}T${startTime}`);
            const reqDuration = parseInt(duration as string) || 60;
            const reqEnd = new Date(reqStart.getTime() + reqDuration * 60000);

            const isBooked = tableBookings.some(b => {
                const bStart = new Date(`${date}T${b.time}`);
                const bDuration = (b as any).duration || 60;
                const bEnd = new Date(bStart.getTime() + bDuration * 60000);

                // Overlap check: (start1 < end2) && (end1 > start2)
                return (reqStart < bEnd) && (reqEnd > bStart);
            });

            status = isBooked ? 'booked' : 'available';
        } else {
            // Fallback to simple check if any booking exists on that day
            status = tableBookings.length > 0 ? 'booked' : 'available';
        }

        return {
            ...table.toObject(),
            bookings: tableBookings,
            status
        };
    });

    res.status(200).json({
        success: true,
        data: result,
    });
});

// ─── POST /api/tables/seed (admin) ─────────────────────────────────────────────
export const seedTables = asyncHandler(async (_req: Request, res: Response) => {
    const existingCount = await TableModel.countDocuments();
    if (existingCount > 0) {
        return res.status(200).json({ success: true, message: 'Tables already seeded.' });
    }

    const initialTables = [
        { tableNumber: 1, capacity: 2, type: 'couple' },
        { tableNumber: 2, capacity: 2, type: 'couple' },
        { tableNumber: 3, capacity: 4, type: 'friends' },
        { tableNumber: 4, capacity: 4, type: 'friends' },
        { tableNumber: 5, capacity: 6, type: 'family' },
        { tableNumber: 6, capacity: 6, type: 'family' },
        { tableNumber: 7, capacity: 8, type: 'family' },
        { tableNumber: 8, capacity: 4, type: 'business' },
        { tableNumber: 9, capacity: 2, type: 'couple' },
        { tableNumber: 10, capacity: 4, type: 'friends' },
    ];

    await TableModel.insertMany(initialTables);

    res.status(201).json({
        success: true,
        message: '10 initial tables seeded successfully.',
    });
});
