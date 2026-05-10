/**
 * order.state-machine.ts — Pure domain logic for order lifecycle.
 *
 * Rules:
 *  - No mongoose imports
 *  - No side effects
 *  - All state knowledge lives here — services just call canTransition()
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus =
    | 'CREATED'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'SERVED'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED';

export interface TransitionResult {
    allowed: boolean;
    reason?: string;
}

export const statusFlow = {
    dinein: ["CREATED", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"],
    takeaway: ["CREATED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP", "COMPLETED"],
    online: ["CREATED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]
};

// ─── State Machine Functions ──────────────────────────────────────────────────

/**
 * Checks whether a status transition is permitted based on order type.
 *
 * @param current - The order's current OrderStatus.
 * @param next    - The desired next OrderStatus.
 * @param orderType - The type of order (dinein, takeaway, online).
 * @returns       TransitionResult { allowed: boolean, reason?: string }
 */
export function canTransition(
    current: OrderStatus, 
    next: OrderStatus, 
    orderType: 'dinein' | 'takeaway' | 'online'
): TransitionResult {
    if (next === 'CANCELLED') {
        const terminalStates: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
        if (terminalStates.includes(current)) {
            return {
                allowed: false,
                reason: `Cannot cancel an order that is already ${current}.`,
            };
        }
        return { allowed: true };
    }

    const flow = statusFlow[orderType];
    if (!flow) {
        return {
            allowed: false,
            reason: `Invalid order type: ${orderType}`,
        };
    }

    const currentIndex = flow.indexOf(current);
    const nextIndex = flow.indexOf(next);

    if (currentIndex === -1) {
        return {
            allowed: false,
            reason: `Current status '${current}' is not valid for order type '${orderType}'.`,
        };
    }

    if (nextIndex === -1) {
        return {
            allowed: false,
            reason: `Target status '${next}' is not valid for order type '${orderType}'.`,
        };
    }

    if (nextIndex === currentIndex + 1) {
        return { allowed: true };
    }

    if (nextIndex <= currentIndex) {
        return {
            allowed: false,
            reason: `Cannot go backward from '${current}' to '${next}'.`,
        };
    }

    return {
        allowed: false,
        reason: `Cannot skip statuses. Next allowed status: '${flow[currentIndex + 1]}'.`,
    };
}

/**
 * Returns all valid next states from the current state.
 */
export function getNextStates(
    current: OrderStatus, 
    orderType: 'dinein' | 'takeaway' | 'online'
): OrderStatus[] {
    const flow = statusFlow[orderType];
    if (!flow) return [];

    const currentIndex = flow.indexOf(current);
    const nextStates: OrderStatus[] = [];

    if (currentIndex !== -1 && currentIndex < flow.length - 1) {
        nextStates.push(flow[currentIndex + 1] as OrderStatus);
    }

    // Cancellation is always an option unless terminal
    if (current !== 'COMPLETED' && current !== 'CANCELLED') {
        nextStates.push('CANCELLED');
    }

    return nextStates;
}

/**
 * Returns true if the status is a terminal state.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
    return status === 'COMPLETED' || status === 'CANCELLED';
}

/**
 * Returns true if the order's stock was already deducted.
 */
export const STOCK_DEDUCTED_STATUSES: readonly OrderStatus[] = [
    'CONFIRMED',
    'PREPARING',
    'READY',
    'SERVED',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
] as const;

export function hadStockDeducted(status: OrderStatus): boolean {
    return (STOCK_DEDUCTED_STATUSES as readonly string[]).includes(status);
}
