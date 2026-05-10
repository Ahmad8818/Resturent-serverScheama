import 'dotenv/config';
import { createApp } from './app';
import connectDb from './config/connectDb';
import { validateDefaultTenancy } from './utils/tenancyValidator';

const PORT = process.env.PORT || 3000;

// ─── Create Express app ──────────────────────────────────────────────────────
const app = createApp();

// ─── Connect DB then start server ────────────────────────────────────────────
const startServer = async () => {
    try {
        await connectDb();
        await validateDefaultTenancy();
        app.listen(PORT, () => {
            console.log(`\n🍽️  Restaurant API running on http://localhost:${PORT}`);
            console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}\n`);
        });
    } catch (error) {
        console.error('❌  Server startup failed:', error);
        process.exit(1);
    }
};

// ─── Graceful shutdown handlers ──────────────────────────────────────────────
process.on('unhandledRejection', (err: Error) => {
    console.error('💥  UNHANDLED REJECTION:', err.message);
    process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
    console.error('💥  UNCAUGHT EXCEPTION:', err.message);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('🛑  SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

startServer();
