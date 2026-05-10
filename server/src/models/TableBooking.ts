import mongoose, { Schema, Document, Types } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type TableType = 'couple' | 'friends' | 'family' | 'business';

export interface ITableBooking extends Document {
    _id: Types.ObjectId;
    branchId: Types.ObjectId; // Reference to Branch
    user?: Types.ObjectId;       // optional – allows guest bookings
    table?: Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    date: Date;
    time: string;                // e.g., "19:30"
    guests: number;
    tableType: TableType;
    duration: number;             // duration in minutes, defaults to 60
    specialRequest?: string;
    status: BookingStatus;
    createdAt: Date;
    updatedAt: Date;
}

const tableBookingSchema = new Schema<ITableBooking>(
    {
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: [true, 'Branch ID is required'],
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            // Optional: allows unauthenticated / guest reservations
        },
        table: {
            type: Schema.Types.ObjectId,
            ref: 'Table',
        },
        name: {
            type: String,
            required: [true, 'Guest name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Reservation date is required'],
        },
        time: {
            type: String,
            required: [true, 'Reservation time is required'],
        },
        guests: {
            type: Number,
            required: [true, 'Number of guests is required'],
            min: [1, 'At least 1 guest is required'],
            max: [20, 'Cannot book for more than 20 guests at once'],
        },
        tableType: {
            type: String,
            enum: ['couple', 'friends', 'family', 'business'],
            required: [true, 'Table type is required'],
        },
        duration: {
            type: Number,
            default: 60,
        },
        specialRequest: {
            type: String,
            maxlength: [500, 'Special request cannot exceed 500 characters'],
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'cancelled'],
            default: 'pending',
        },
    },
    { timestamps: true },
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
tableBookingSchema.index({ date: 1 });
tableBookingSchema.index({ user: 1 });
tableBookingSchema.index({ status: 1 });
tableBookingSchema.index({ branchId: 1 });
tableBookingSchema.index({ branchId: 1, date: 1, status: 1 }); // Composite index for availability queries

const TableBookingModel = mongoose.model<ITableBooking>('TableBooking', tableBookingSchema);
export default TableBookingModel;
