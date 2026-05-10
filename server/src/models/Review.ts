import mongoose, { Schema, Document, Types } from 'mongoose';
import MenuItemModel from './MenuItem';

export interface IReview extends Document {
    _id: Types.ObjectId;
    review: string;
    rating: number;
    user: Types.ObjectId;
    menuItem: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
    {
        review: {
            type: String,
            required: [true, 'Review text is required'],
            trim: true,
            maxlength: [1000, 'Review cannot exceed 1000 characters'],
        },
        rating: {
            type: Number,
            required: [true, 'Rating is required'],
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5'],
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Review must belong to a user'],
        },
        menuItem: {
            type: Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: [true, 'Review must belong to a menu item'],
        },
    },
    { timestamps: true },
);

// ─── Compound unique index: one review per user per menu item ─────────────────
reviewSchema.index({ user: 1, menuItem: 1 }, { unique: true });

// ─── Populate user on query ───────────────────────────────────────────────────
// Note: Populate is handled in controllers to avoid circular dependency issues
// reviewSchema.pre(/^find/, function (next) {
//     (this as mongoose.Query<IReview[], IReview>).populate({
//         path: 'user',
//         select: 'name avatar email',
//     });
//     next();
// });

// ─── Post-save: recalculate ratings on MenuItem ───────────────────────────────
reviewSchema.post<IReview>('save', async function () {
    await MenuItemModel.calcAverageRatings(this.menuItem);
});

// ─── Post-delete: recalculate ratings on MenuItem ────────────────────────────
reviewSchema.post(
    /^findOneAnd/,
    async (doc: IReview | null) => {
        if (doc) {
            await MenuItemModel.calcAverageRatings(doc.menuItem);
        }
    },
);

const ReviewModel = mongoose.model<IReview>('Review', reviewSchema);
export default ReviewModel;
