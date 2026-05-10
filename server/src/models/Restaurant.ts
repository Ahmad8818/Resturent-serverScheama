import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRestaurant extends Document {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    location?: string;
    logo?: {
        url: string;
        public_id: string;
    };
    owner: Types.ObjectId; // Reference to User (Admin)
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const restaurantSchema = new Schema<IRestaurant>(
    {
        name: {
            type: String,
            required: [true, 'Restaurant name is required'],
            trim: true,
            unique: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        location: {
            type: String,
        },
        logo: {
            url: { type: String, default: '' },
            public_id: { type: String, default: '' },
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'ResturentUser', // Matching the model name in User.ts
            required: [true, 'Owner is required'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

// Indexes
restaurantSchema.index({ name: 1 });
restaurantSchema.index({ owner: 1 });

const RestaurantModel = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);
export default RestaurantModel;
