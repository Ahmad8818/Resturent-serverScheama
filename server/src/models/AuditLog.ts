import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
    action: string;
    performedBy: Types.ObjectId;
    branch: Types.ObjectId;
    resourceType: 'ORDER' | 'INVENTORY' | 'PAYMENT' | 'USER';
    resourceId: Types.ObjectId;
    details: {
        oldValue?: any;
        newValue?: any;
        message?: string;
    };
    timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
    action: {
        type: String,
        required: true,
        index: true
    },
    performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'ResturentUser',
        required: true,
        index: true
    },
    branch: {
        type: Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
        index: true
    },
    resourceType: {
        type: String,
        enum: ['ORDER', 'INVENTORY', 'PAYMENT', 'USER'],
        required: true
    },
    resourceId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    details: {
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        message: String
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, { timestamps: false });

// Optimize for time-series analysis
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ branch: 1, resourceType: 1 });

const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLogModel;
