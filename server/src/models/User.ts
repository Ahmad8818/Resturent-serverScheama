import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAddress {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: 'user' | 'admin' | 'manager' | 'kitchen' | 'chef' | 'delivery' | 'waiter';
    activeOrdersCount: number;
    maxCapacity: number;
    onDuty: boolean;
    isAvailable: boolean;
    branchId?: Types.ObjectId;
    phone?: string;
    avatar?: {
        url: string;
        public_id: string;
    };
    address?: IAddress;
    verify_email: boolean;
    otp?: string | null;
    otpExpires?: Date | null;
    last_login_date?: Date;
    refresh_token?: string;
    status: 'Active' | 'Inactive' | 'Suspended';
    signUpWithGoogle: boolean;
    order_history: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const addressSchema = new Schema<IAddress>(
    {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipCode: { type: String },
    },
    { _id: false },
);

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: [true, 'Please provide your name'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [60, 'Name cannot exceed 60 characters'],
        },
        email: {
            type: String,
            required: [true, 'Please provide your email'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false,
        },
        role: {
            type: String,
            enum: ['user', 'admin', 'manager', 'kitchen', 'chef', 'delivery', 'waiter'],
            default: 'user',
        },
        activeOrdersCount: {
            type: Number,
            default: 0,
        },
        maxCapacity: {
            type: Number,
            default: 2,
        },
        onDuty: {
            type: Boolean,
            default: false,
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: function(this: any) {
                return this.role !== 'admin' && this.role !== 'user';
            }
        },
        phone: {
            type: String,
            trim: true,
        },
        avatar: {
            url: { type: String, default: '' },
            public_id: { type: String, default: '' },
        },
        address: {
            type: addressSchema,
        },
        verify_email: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: String,
            default: null,
        },
        otpExpires: {
            type: Date,
            default: null,
        },
        last_login_date: {
            type: Date,
        },
        refresh_token: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Suspended'],
            default: 'Active',
        },
        signUpWithGoogle: {
            type: Boolean,
            default: false,
        },
        order_history: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ResturentOrder',
            },
        ],
    },
    { timestamps: true },
);

// ─── Pre-save: Hash password ─────────────────────────────────────────────────
userSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password')) return next();
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ─── Instance method: compare passwords ──────────────────────────────────────
userSchema.methods.comparePassword = async function (
    candidatePassword: string,
): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(candidatePassword, this.password);
};

// ─── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ branchId: 1, role: 1 });
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });

const UserModel = mongoose.model<IUser>('ResturentUser', userSchema);
export default UserModel;
