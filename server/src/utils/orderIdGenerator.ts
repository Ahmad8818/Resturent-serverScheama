import Counter from '../models/Counter';

/**
 * Gets the next sequence number for a specific day.
 * Resets daily based on the UTC date string (YYYY-MM-DD).
 */
async function getNextOrderSequence(): Promise<number> {
    const now = new Date();
    // Use local date YYYY-MM-DD to match the restaurant's operating day
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${date}`;
    const counterId = `order_${today}`;

    const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return counter.seq;
}

/**
 * Formats the order ID as PREFIX-DDSSSS
 * PREFIX: 3-digit branch identifier
 * DD: Day of the month (01-31)
 * SSSS: 4-digit sequence (0001-9999)
 */
function formatOrderId(seq: number, branchPrefix: string): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const sequence = String(seq).padStart(4, '0');
    const prefix = branchPrefix.substring(0, 3).toUpperCase();
    return `${prefix}-${day}${sequence}`;
}

/**
 * Generates a unique, production-ready order ID with branch prefix.
 */
export async function generateUniqueOrderId(branchPrefix: string): Promise<string> {
    const seq = await getNextOrderSequence();
    return formatOrderId(seq, branchPrefix);
}
