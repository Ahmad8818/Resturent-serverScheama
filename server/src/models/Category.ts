import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
    _id: Types.ObjectId;
    name: string;
    image?: {
        url: string;
        public_id: string;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            unique: true,
            trim: true,
            maxlength: [50, 'Category name cannot exceed 50 characters'],
        },
        image: {
            url: {
                type: String,
                default: '',
            },
            public_id: {
                type: String,
                default: '',
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

const CategoryModel = mongoose.model<ICategory>('Category', categorySchema, 'resturentcats');
export default CategoryModel;
