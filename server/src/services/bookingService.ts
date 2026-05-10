import TableModel, { ITable } from '../models/Table';
import TableBookingModel, { ITableBooking } from '../models/TableBooking';
import BranchModel, { IBranch } from '../models/Branch';
import AppError from '../utils/AppError';
import { isValidObjectId } from '../utils/mongoose';

/**
 * Helper: Convert time string (HH:mm) to minutes since midnight
 */
export const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Helper: Convert minutes since midnight back to time string (HH:mm)
 */
export const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Check if two time ranges overlap
 * Returns true if [start1, end1] overlaps with [start2, end2]
 */
export const timesOverlap = (
    start1Mins: number,
    end1Mins: number,
    start2Mins: number,
    end2Mins: number,
): boolean => {
    return start1Mins < end2Mins && end1Mins > start2Mins;
};

/**
 * Check if a specific table is available at a given date/time/duration
 * @param tableId - MongoDB ObjectId of the table
 * @param date - Date object (date only, time is ignored)
 * @param timeStr - Time string (HH:mm format)
 * @param durationMins - Duration in minutes
 * @returns true if table is available, false otherwise
 */
export const isTableAvailable = async (
    tableId: string,
    date: Date,
    timeStr: string,
    durationMins: number,
): Promise<boolean> => {
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const dayEnd = new Date(bookingDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Find all confirmed/pending bookings for this table on this date
    const existingBookings = await TableBookingModel.find({
        table: tableId,
        date: { $gte: bookingDate, $lte: dayEnd },
        status: { $in: ['confirmed', 'pending'] },
    });

    // Calculate requested booking time range
    const requestStartMins = timeToMinutes(timeStr);
    const requestEndMins = requestStartMins + durationMins;

    // Check for overlaps
    for (const booking of existingBookings) {
        const existingStartMins = timeToMinutes(booking.time);
        const existingEndMins = existingStartMins + (booking.duration || 60);

        if (timesOverlap(requestStartMins, requestEndMins, existingStartMins, existingEndMins)) {
            return false;
        }
    }

    return true;
};

/**
 * Find available tables for given criteria
 * @param branchId - Branch ID
 * @param date - Date object
 * @param timeStr - Time in HH:mm format
 * @param guests - Number of guests
 * @param durationMins - Duration in minutes
 * @returns Array of available tables
 */
export const findAvailableTables = async (
    branchId: string,
    date: Date,
    timeStr: string,
    guests: number,
    durationMins: number,
): Promise<ITable[]> => {
    const resolvedBranchId = branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;
    
    // Find tables that fit the capacity
    const potentialTables = await TableModel.find({
        branchId: resolvedBranchId,
        capacity: { $gte: guests },
        isActive: true,
    }).sort({ capacity: 1 }); // Prioritize smaller tables first

    const availableTables: ITable[] = [];

    for (const table of potentialTables) {
        const available = await isTableAvailable(table._id.toString(), date, timeStr, durationMins);
        if (available) {
            availableTables.push(table);
        }
    }

    return availableTables;
};

/**
 * Get available time slots for a given date and branch
 * Returns an array of time slots (e.g., ["18:00", "18:30", "19:00", ...])
 * where at least one table is available
 * @param branchId - Branch ID
 * @param date - Date object
 * @param slotIntervalMins - Interval between slots (default: 30 minutes)
 * @param durationMins - Booking duration (default: 60 minutes)
 * @param guests - Number of guests
 * @returns Array of available time slot strings
 */
export const getAvailableTimeSlots = async (
    branchId: string,
    date: Date,
    guests: number,
    slotIntervalMins: number = 30,
    durationMins: number = 60,
): Promise<string[]> => {
    const resolvedBranchId = branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;
    
    if (!isValidObjectId(resolvedBranchId)) {
        throw new AppError(`Invalid Branch ID format: ${resolvedBranchId}`, 400);
    }

    const branch = await BranchModel.findById(resolvedBranchId);
    if (!branch) {
        throw new AppError('Branch not found', 404);
    }

    // Get operating hours for the date's day of week
    const dayOfWeek = date.getDay();
    const operatingHour = branch.operatingHours.find((oh) => oh.dayOfWeek === dayOfWeek);

    if (!operatingHour) {
        // Branch is closed on this day
        return [];
    }

    const openTimeMins = timeToMinutes(operatingHour.openTime);
    const closeTimeMins = timeToMinutes(operatingHour.closeTime);
    const availableSlots: string[] = [];

    // Generate time slots based on interval
    for (let slotMins = openTimeMins; slotMins + durationMins <= closeTimeMins; slotMins += slotIntervalMins) {
        const slotTime = minutesToTime(slotMins);

        // Check if at least one table is available for this slot
        const availableTables = await findAvailableTables(resolvedBranchId as string, date, slotTime, guests, durationMins);
        if (availableTables.length > 0) {
            availableSlots.push(slotTime);
        }
    }

    return availableSlots;
};

/**
 * Validate booking date and time against branch operating hours
 * @param branchId - Branch ID
 * @param date - Date object
 * @param timeStr - Time in HH:mm format
 * @throws Error if date/time is invalid or outside operating hours
 */
export const validateBookingDateTime = async (branchId: string, date: Date, timeStr: string): Promise<void> => {
    const resolvedBranchId = branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;

    if (!isValidObjectId(resolvedBranchId)) {
        throw new AppError(`Invalid Branch ID format: ${resolvedBranchId}`, 400);
    }

    const branch = await BranchModel.findById(resolvedBranchId);
    if (!branch) {
        throw new AppError(`Branch with ID "${resolvedBranchId}" not found. Please ensure the branch exists in the database.`, 404);
    }

    // Check if date is in the future (or today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
        throw new AppError('Cannot book for a past date', 400);
    }

    // Check operating hours
    const dayOfWeek = bookingDate.getDay();
    const operatingHour = branch.operatingHours.find((oh) => oh.dayOfWeek === dayOfWeek);

    if (!operatingHour) {
        throw new AppError('Branch is not operating on this day', 400);
    }

    const bookingTimeMins = timeToMinutes(timeStr);
    const openTimeMins = timeToMinutes(operatingHour.openTime);
    const closeTimeMins = timeToMinutes(operatingHour.closeTime);

    if (bookingTimeMins < openTimeMins || bookingTimeMins >= closeTimeMins) {
        throw new AppError(
            `Booking time must be between ${operatingHour.openTime} and ${operatingHour.closeTime}`,
            400,
        );
    }
};

/**
 * Get available tables with their details for a given date/time
 * @param branchId - Branch ID
 * @param date - Date object
 * @param timeStr - Time in HH:mm format
 * @param guests - Number of guests
 * @param durationMins - Duration in minutes
 * @returns Object with availableTables and availableSlots
 */
export const getAvailabilityDetails = async (
    branchId: string,
    date: Date,
    timeStr: string,
    guests: number,
    durationMins: number = 60,
) => {
    // Validate branch exists and date/time are valid
    await validateBookingDateTime(branchId, date, timeStr);

    // Get available tables for the specific time
    const availableTables = await findAvailableTables(branchId, date, timeStr, guests, durationMins);

    // Get all available time slots for the date
    const availableSlots = await getAvailableTimeSlots(branchId, date, guests, 30, durationMins);

    return {
        availableTables: availableTables.map((table) => ({
            _id: table._id,
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            type: table.type,
        })),
        availableSlots,
        canBook: availableTables.length > 0,
    };
};

/**
 * Create a booking with validation
 */
export const createBookingWithValidation = async (bookingData: {
    branchId: string;
    name: string;
    email: string;
    phone: string;
    date: Date;
    time: string;
    guests: number;
    tableType?: string;
    tableId?: string;
    duration?: number;
    specialRequest?: string;
    userId?: string;
}) => {
    const branchId = bookingData.branchId || process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;
    const durationMins = bookingData.duration || 60;

    if (!isValidObjectId(branchId)) {
        throw new AppError(`Invalid Branch ID format for booking: ${branchId}`, 400);
    }

    // Validate date and time
    await validateBookingDateTime(branchId as string, bookingData.date, bookingData.time);

    let assignedTableId = bookingData.tableId;

    // If no table specified, find an available one
    if (!assignedTableId) {
        const availableTables = await findAvailableTables(
            branchId as string,
            bookingData.date,
            bookingData.time,
            bookingData.guests,
            durationMins,
        );

        if (availableTables.length === 0) {
            throw new AppError(
                'No tables available for the selected date, time, and number of guests',
                400,
            );
        }

        // Pick the smallest available table that fits the guests
        assignedTableId = availableTables[0]._id.toString();
    } else {
        if (!isValidObjectId(assignedTableId)) {
             throw new AppError(`Invalid Table ID format: ${assignedTableId}`, 400);
        }

        // Verify the specified table is available
        const isAvailable = await isTableAvailable(
            assignedTableId!,
            bookingData.date,
            bookingData.time,
            durationMins,
        );

        if (!isAvailable) {
            throw new AppError('The specified table is not available for the selected time', 400);
        }
    }

    // Create the booking
    const booking = await TableBookingModel.create({
        branchId: branchId,
        user: bookingData.userId,
        table: assignedTableId,
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone,
        date: bookingData.date,
        time: bookingData.time,
        guests: bookingData.guests,
        tableType: bookingData.tableType || 'friends',
        duration: durationMins,
        specialRequest: bookingData.specialRequest,
        status: 'pending',
    });

    return booking;
};
