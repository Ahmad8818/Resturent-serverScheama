class AppError extends Error {
    public readonly statusCode: number;
    public readonly status: string;
    public readonly success: boolean = false;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        // Capture stack trace (v8 only)
        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError;
