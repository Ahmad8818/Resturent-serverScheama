import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IMenuItem extends Document {
    _id: Types.ObjectId;
    name: string;
    description: string;
    price: number;
    category: Types.ObjectId;
    branchId: Types.ObjectId; // Reference to Branch
    image: {
        url: string;
        public_id: string;
    };
    ingredients: string[];
    isVegetarian: boolean;
    averageRating: number;
    ratingsQuantity: number;
    isAvailable: boolean;
    /**
     * Numeric stock level. Atomic `$inc` operations decrement / increment this
     * value. Set to `9999` by default (uncapped) until inventory management is
     * active for a given item.
     */
    stock: number;
    featured: boolean;
    isDeal: boolean;
    dealPrice?: number;
    preparationTime?: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

interface IMenuItemModel extends Model<IMenuItem> {
    calcAverageRatings(menuItemId: Types.ObjectId): Promise<void>;
}

const menuItemSchema = new Schema<IMenuItem, IMenuItemModel>(
    {
        name: {
            type: String,
            required: [true, 'Menu item name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: [true, 'Category is required'],
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: [true, 'Branch is required'],
        },
        image: {
            url: {
                type: String,
                required: [true, 'Image URL is required'],
            },
            public_id: {
                type: String,
                required: [true, 'Cloudinary public_id is required'],
            },
        },
        ingredients: {
            type: [String],
            default: [],
        },
        isVegetarian: {
            type: Boolean,
            default: false,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: [0, 'Rating cannot be below 0'],
            max: [5, 'Rating cannot be above 5'],
            set: (val: number) => Math.round(val * 10) / 10,
        },
        ratingsQuantity: {
            type: Number,
            default: 0,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        stock: {
            type: Number,
            default: 9999,          // Treat as 'uncapped' until inventory is actively managed
            min: [0, 'Stock cannot be negative'],
        },
        featured: {
            type: Boolean,
            default: false,
        },
        isDeal: {
            type: Boolean,
            default: false,
        },
        dealPrice: {
            type: Number,
            min: [0, 'Deal price cannot be negative'],
        },
        preparationTime: {
            type: Number,    // in minutes
            min: [0, 'Preparation time cannot be negative'],
        },
        tags: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ branchId: 1 });
menuItemSchema.index({ averageRating: -1 });
menuItemSchema.index({ price: 1 });
// Compound index used by the atomic deduction query: { _id, branchId, isAvailable, stock }
menuItemSchema.index({ branchId: 1, isAvailable: 1, stock: 1 });

// ─── Hook: auto-disable item when stock is exhausted ─────────────────────────
menuItemSchema.pre('save', function (next) {
    if (this.isModified('stock') && this.stock <= 0) {
        this.isAvailable = false;
        this.stock = 0;   // clamp — never go negative
    }
    next();
});

// ─── Static: recalculate average rating ──────────────────────────────────────
menuItemSchema.statics.calcAverageRatings = async function (
    menuItemId: Types.ObjectId,
): Promise<void> {
    // Use lazy import to avoid circular dependency
    const ReviewModel = (await import('./Review')).default;
    const stats = await ReviewModel.aggregate([
        { $match: { menuItem: menuItemId } },
        {
            $group: {
                _id: '$menuItem',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' },
            },
        },
    ]);

    if (stats.length > 0) {
        await (this as IMenuItemModel).findByIdAndUpdate(menuItemId, {
            ratingsQuantity: stats[0].nRating,
            averageRating: stats[0].avgRating,
        });
    } else {
        await (this as IMenuItemModel).findByIdAndUpdate(menuItemId, {
            ratingsQuantity: 0,
            averageRating: 0,
        });
    }
};

// const MenuItemModel = mongoose.model<IMenuItem, IMenuItemModel>('MenuItem', menuItemSchema);
// export default MenuItemModel;
//     if (stats.length > 0) {
//         await (this as IMenuItemModel).findByIdAndUpdate(menuItemId, {
//             ratingsQuantity: stats[0].nRating,
//             averageRating: stats[0].avgRating,
//         });
//     } else {
//         await (this as IMenuItemModel).findByIdAndUpdate(menuItemId, {
//             ratingsQuantity: 0,
//             averageRating: 0,
//         });
//     }
// };

const MenuItemModel = mongoose.model<IMenuItem, IMenuItemModel>('MenuItem', menuItemSchema);
export default MenuItemModel;
