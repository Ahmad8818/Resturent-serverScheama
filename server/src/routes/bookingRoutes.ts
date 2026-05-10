import { Router } from 'express';
import {
    createBooking,
    getMyBookings,
    getAllBookings,
    getBookingById,
    editBooking,
    updateBookingStatus,
    deleteBooking,
    getAvailableBookings,
    getTimeSlots,
} from '../controllers/bookingController';
import protect from '../middleware/protect';
import restrictTo from '../middleware/restrictTo';

import validate, { ValidationSource } from '../middleware/validate';
import { 
    createBookingSchema, 
    updateBookingStatusSchema, 
    idParamSchema,
    getAvailableSlotsSchema,
    getTimeSlotsSchema 
} from '../schemas/additionalSchemas';

const router = Router();

// Public: anyone can check availability and time slots
router.get('/available', validate(getAvailableSlotsSchema, ValidationSource.QUERY), getAvailableBookings);
router.get('/time-slots', validate(getTimeSlotsSchema, ValidationSource.QUERY), getTimeSlots);

// Public: anyone (logged-in or guest) can create a booking
router.post('/', validate(createBookingSchema), createBooking);

// Protected user routes
router.get('/my-bookings', protect, getMyBookings);
router.get('/:id', protect, validate(idParamSchema, ValidationSource.PARAMS), getBookingById);
router.patch('/:id', protect, validate(idParamSchema, ValidationSource.PARAMS), editBooking);

// Admin-only routes
router.get('/', protect, restrictTo('admin'), getAllBookings);
router.patch('/:id/status', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), validate(updateBookingStatusSchema), updateBookingStatus);
router.delete('/:id', protect, restrictTo('admin'), validate(idParamSchema, ValidationSource.PARAMS), deleteBooking);

export default router;
