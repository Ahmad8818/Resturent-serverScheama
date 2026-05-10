import mongoose, { Schema, Document, Types } from 'mongoose';

export type TableType = 'couple' | 'friends' | 'family' | 'business';

export interface ITable extends Document {
    _id: Types.ObjectId;
    tableNumber: number;
    capacity: number;
    type: TableType;
    branchId: Types.ObjectId; // Reference to Branch
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const tableSchema = new Schema<ITable>(
    {
        tableNumber: {
            type: Number,
            required: [true, 'Table number is required'],
            unique: true,
            min: [1, 'Table number must be positive'],
        },
        capacity: {
            type: Number,
            required: [true, 'Capacity is required'],
            min: [1, 'Capacity must be at least 1'],
        },
        type: {
            type: String,
            enum: ['couple', 'friends', 'family', 'business'],
            required: [true, 'Table type is required'],
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: [true, 'Branch ID is required'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

// Add index for branch queries
tableSchema.index({ branchId: 1 });

const TableModel = mongoose.model<ITable>('Table', tableSchema);
export default TableModel;
