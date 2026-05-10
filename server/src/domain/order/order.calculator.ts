/**
 * order.calculator.ts — Pure domain logic for order pricing.
 *
 * Rules:
 *  - No mongoose imports
 *  - No side effects
 *  - Deterministic: same input → same output
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricedLineItem {
    price:    number;
    quantity: number;
}

export interface OrderTotals {
    subTotal:    number;
    tax:         number;
    deliveryFee: number;
    totalAmount: number;
}

export type OrderType = 'online' | 'dinein' | 'takeaway';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Unified tax rate applied to all order types. */
const TAX_RATE = 0.15;

/** Flat delivery fee for online orders; free for dine-in and takeaway. */
const ONLINE_DELIVERY_FEE = 300.00;

// ─── Calculator ───────────────────────────────────────────────────────────────

/**
 * Calculates the breakdown of an order's monetary totals.
 * All values are rounded to 2 decimal places.
 *
 * @param items     - Line items with server-locked prices and quantities.
 * @param orderType - Determines whether a delivery fee applies.
 * @returns         OrderTotals object with subTotal, tax, deliveryFee, totalAmount.
 */
export function calculateOrderTotals(
    items:     PricedLineItem[],
    orderType: OrderType,
): OrderTotals {
    const subTotal    = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
    const tax         = round2(subTotal * TAX_RATE);
    const deliveryFee = orderType === 'online' ? ONLINE_DELIVERY_FEE : 0.00;
    const totalAmount = round2(subTotal + tax + deliveryFee);

    // DEBUG: Log calculation details
    console.log('[OrderCalculator] Calculation Details:', {
        items: items.map(i => ({ price: i.price, quantity: i.quantity, lineTotal: i.price * i.quantity })),
        subTotal,
        tax,
        deliveryFee,
        totalAmount,
        orderType
    });

    return { subTotal, tax, deliveryFee, totalAmount };
}

/** Rounds a number to 2 decimal places — avoids floating-point drift. */
function round2(value: number): number {
    return parseFloat(value.toFixed(2));
}
