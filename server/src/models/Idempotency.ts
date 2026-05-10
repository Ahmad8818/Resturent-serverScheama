import mongoose, { Schema, Document } from 'mongoose';

export interface IIdempotency extends Document {
    key: string;
    responsePayload: any;
    expiresAt: Date;
}

const idempotencySchema = new Schema<IIdempotency>(
    {
        key: {
            type: String,
            required: [true, 'Idempotency key is required'],
            unique: true,
            index: true,
        },
        responsePayload: {
            type: Schema.Types.Mixed,
            required: [true, 'Response payload is required'],
        },
        expiresAt: {
            type: Date,
            required: true,
            expires: 0, // MongoDB TTL index: Document deletes automatically at this time
        },
    },
    { timestamps: true }
);

const IdempotencyModel = mongoose.model<IIdempotency>('Idempotency', idempotencySchema);
export default IdempotencyModel;
