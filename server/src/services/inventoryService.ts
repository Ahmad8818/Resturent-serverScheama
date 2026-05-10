import { ClientSession } from 'mongoose';
import { MenuRepository } from '../repositories/menu.repository';
import AppError from '../utils/AppError';
import type { IOrder } from '../models/Order';

// ─── Internal ledger type ─────────────────────────────────────────────────────

interface DeductionRecord {
    menuItemId: string;
    quantity:   number;
}

// ─── InventoryService ─────────────────────────────────────────────────────────

/**
 * Atomic inventory management — all stock operations delegate to
 * MenuRepository which issues single-roundtrip findOneAndUpdate calls.
 *
 * Design guarantees:
 *  - Check + Deduct are ONE atomic MongoDB write (no TOCTOU window).
 *  - Rollback is the exact inverse $inc of deduction.
 *  - Every method accepts an optional ClientSession for ACID composition.
 */
export class InventoryService {

    // ── Validation ─────────────────────────────────────────────────────────────

    /**
     * Checks if all items in an order have sufficient stock.
     * Does NOT deduct stock. Used for pre-payment or post-payment validation.
     * Throws AppError(409) if any item is insufficient.
     */
    static async validateStockForOrder(order: IOrder): Promise<void> {
        const branchId = order.branchId.toString();
        const itemIds = order.items.map(i => i.menuItem.toString());
        
        // Fetch original items to check their current stock
        const menuItems = await MenuRepository.findAvailableByIdsAndBranch(itemIds, branchId);

        for (const lineItem of order.items) {
            const mi = menuItems.find(m => m._id.toString() === lineItem.menuItem.toString());
            
            if (!mi || mi.stock < lineItem.quantity) {
                throw new AppError(
                    `Insufficient stock for '${lineItem.name}'. Required: ${lineItem.quantity}, Available: ${mi?.stock ?? 0}`,
                    409
                );
            }
        }
    }

    // ── Deduction ──────────────────────────────────────────────────────────────

    /**
     * Atomically deducts stock for every line item in an order.
     *
     * Iteration is sequential so that if item N fails, the exact set of
     * items 0..N-1 that succeeded is known and can be rolled back before
     * throwing — making the error surface deterministic under concurrency.
     *
     * Throws AppError(409) on first failure after rolling back any partial
     * deductions.
     */
    static async deductStockForOrder(
        order:   IOrder,
        session?: ClientSession,
    ): Promise<void> {
        const branchId = order.branchId.toString();
        const deducted: DeductionRecord[] = [];

        for (const lineItem of order.items) {
            const updated = await MenuRepository.atomicDeductStock(
                lineItem.menuItem.toString(),
                branchId,
                lineItem.quantity,
                session,
            );

            if (updated === null) {
                // Roll back all items already deducted before throwing
                await InventoryService._rollbackDeducted(deducted, branchId, session);

                throw new AppError(
                    `Insufficient stock or item unavailable: '${lineItem.name ?? lineItem.menuItem}'. ` +
                    'Please adjust your cart and try again.',
                    409,
                );
            }

            deducted.push({
                menuItemId: lineItem.menuItem.toString(),
                quantity:   lineItem.quantity,
            });
        }
    }

    // ── Rollback ───────────────────────────────────────────────────────────────

    /**
     * Restores stock for all line items in an order.
     *
     * Called when an order is cancelled or a bank transfer is rejected.
     * Individual failures are caught and logged (non-fatal) so that one
     * bad restore doesn't block the rest.
     */
    static async rollbackStockForOrder(
        order:   IOrder,
        session?: ClientSession,
    ): Promise<void> {
        const branchId = order.branchId.toString();

        for (const lineItem of order.items) {
            try {
                await MenuRepository.atomicRestoreStock(
                    lineItem.menuItem.toString(),
                    branchId,
                    lineItem.quantity,
                    session,
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                    `[InventoryService] Restore failed for item ` +
                    `${lineItem.menuItem} on order ${order._id}: ${msg}`,
                );
            }
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /** Best-effort rollback of a partial deduction list (within the same session). */
    private static async _rollbackDeducted(
        deducted: DeductionRecord[],
        branchId: string,
        session?: ClientSession,
    ): Promise<void> {
        for (const record of deducted) {
            try {
                await MenuRepository.atomicRestoreStock(
                    record.menuItemId,
                    branchId,
                    record.quantity,
                    session,
                );
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                    `[InventoryService] Partial rollback failed for item ` +
                    `${record.menuItemId}: ${msg}`,
                );
            }
        }
    }
}
