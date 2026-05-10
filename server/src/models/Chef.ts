import mongoose, { Schema, Document, Types } from 'mongoose';

interface ISignatureDish {
    name: string;
    description: string;
}

interface ISocialLinks {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
}

export interface IChef extends Document {
    _id: Types.ObjectId;
    name: string;
    role: string;               // e.g., "Executive Chef", "Pastry Chef"
    specialty?: string;
    experienceYears?: number;
    bio?: string;
    quote?: string;
    image?: {
        url: string;
        public_id: string;
    };
    signatureDishes: ISignatureDish[];
    awards: string[];
    socialLinks: ISocialLinks;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const signatureDishSchema = new Schema<ISignatureDish>(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
    },
    { _id: false },
);

const socialLinksSchema = new Schema<ISocialLinks>(
    {
        instagram: { type: String, trim: true },
        linkedin: { type: String, trim: true },
        twitter: { type: String, trim: true },
    },
    { _id: false },
);

const chefSchema = new Schema<IChef>(
    {
        name: {
            type: String,
            required: [true, 'Chef name is required'],
            trim: true,
        },
        role: {
            type: String,
            required: [true, 'Chef role is required'],
            trim: true,
            // e.g., "Executive Chef", "Head Pastry Chef"
        },
        specialty: {
            type: String,
            trim: true,
        },
        experienceYears: {
            type: Number,
            min: [0, 'Experience years cannot be negative'],
        },
        bio: {
            type: String,
            maxlength: [2000, 'Bio cannot exceed 2000 characters'],
        },
        quote: {
            type: String,
            maxlength: [300, 'Quote cannot exceed 300 characters'],
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
        signatureDishes: {
            type: [signatureDishSchema],
            default: [],
        },
        awards: {
            type: [String],
            default: [],
        },
        socialLinks: {
            type: socialLinksSchema,
            default: {},
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

const ChefModel = mongoose.model<IChef>('Chef', chefSchema);
export default ChefModel;
