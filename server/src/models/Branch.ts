import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILocation {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    zipCode?: string;
}

export interface IBranch extends Document {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    location: ILocation;
    contact: {
        phone: string;
        email?: string;
    };
    totalCapacity: number;
    maxBookingDuration: number; // in minutes (default: 120)
    minBookingDuration: number; // in minutes (default: 60)
    bufferTime: number; // in minutes between bookings (default: 15)
    operatingHours: {
        dayOfWeek: number; // 0-6 (Sunday=0)
        openTime: string; // "09:00"
        closeTime: string; // "23:00"
    }[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const locationSchema = new Schema(
    {
        latitude: {
            type: Number,
            required: [true, 'Latitude is required'],
        },
        longitude: {
            type: Number,
            required: [true, 'Longitude is required'],
        },
        address: {
            type: String,
            required: [true, 'Address is required'],
            trim: true,
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true,
        },
        zipCode: {
            type: String,
            trim: true,
        },
    },
    { _id: false },
);

const operatingHoursSchema = new Schema(
    {
        dayOfWeek: {
            type: Number,
            enum: [0, 1, 2, 3, 4, 5, 6],
            required: [true, 'Day of week is required (0-6)'],
        },
        openTime: {
            type: String,
            required: [true, 'Open time is required (HH:mm)'],
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'],
        },
        closeTime: {
            type: String,
            required: [true, 'Close time is required (HH:mm)'],
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'],
        },
    },
    { _id: false },
);

const branchSchema = new Schema<IBranch>(
    {
        name: {
            type: String,
            required: [true, 'Branch name is required'],
            trim: true,
            unique: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        location: {
            type: locationSchema,
            required: [true, 'Location is required'],
        },
        contact: {
            phone: {
                type: String,
                required: [true, 'Phone is required'],
                trim: true,
                match: [/^[+]?[0-9\s()\-]{9,15}$/, 'Phone must be 10-15 digits (can include +, spaces, hyphens, parentheses)'],
            },
            email: {
                type: String,
                trim: true,
                lowercase: true,
                match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
            },
        },
        totalCapacity: {
            type: Number,
            required: [true, 'Total capacity is required'],
            min: [1, 'Capacity must be at least 1'],
        },
        maxBookingDuration: {
            type: Number,
            default: 120,
            min: [30, 'Max booking duration must be at least 30 minutes'],
        },
        minBookingDuration: {
            type: Number,
            default: 60,
            min: [15, 'Min booking duration must be at least 15 minutes'],
        },
        bufferTime: {
            type: Number,
            default: 15,
            min: [0, 'Buffer time cannot be negative'],
            max: [60, 'Buffer time cannot exceed 60 minutes'],
        },
        operatingHours: {
            type: [operatingHoursSchema],
            required: [true, 'Operating hours are required'],
            validate: {
                validator: function (value: any[]) {
                    // Ensure we have hours for each day
                    return value.length > 0;
                },
                message: 'At least one operating hour entry is required',
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

// Indexes
branchSchema.index({ name: 1 });
branchSchema.index({ 'location.city': 1 });
branchSchema.index({ isActive: 1 });

const BranchModel = mongoose.model<IBranch>('Branch', branchSchema);
export default BranchModel;
