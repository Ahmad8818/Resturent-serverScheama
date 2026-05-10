import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter {
    _id: string; // Identifier for the counter (e.g., 'order_2026-05-01')
    seq: number;
}

const counterSchema = new Schema<ICounter>({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const CounterModel = mongoose.model<ICounter>('Counter', counterSchema);
export default CounterModel;
