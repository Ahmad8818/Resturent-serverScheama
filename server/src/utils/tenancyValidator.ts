import BranchModel from '../models/Branch';
import { isValidObjectId } from './mongoose';

/**
 * Validates the configured default tenancy at server startup.
 * Throws an error if the configuration is invalid, preventing silent failures.
 */
export const validateDefaultTenancy = async () => {
    const defaultId = process.env.DEFAULT_BRANCH_ID || process.env.DEFAULT_RESTAURANT_ID;

    console.log('🔍 [Startup] Validating Default Tenancy Configuration...');

    if (!defaultId) {
        console.warn('⚠️  [Startup] No DEFAULT_BRANCH_ID or DEFAULT_RESTAURANT_ID found in .env');
        return;
    }

    if (!isValidObjectId(defaultId)) {
        throw new Error(
            `❌ [Startup] Invalid DEFAULT_BRANCH_ID format: "${defaultId}". Must be a 24-char hex string.`,
        );
    }

    try {
        const branch = await BranchModel.findById(defaultId);
        if (!branch) {
            throw new Error(
                `❌ [Startup] Default Branch not found in database! ID: ${defaultId}. ` +
                'Please check your .env settings and ensure the branch exists in the "branches" collection.',
            );
        }

        console.log(`✅ [Startup] Default Tenancy Validated: "${branch.name}" (${branch._id})`);
    } catch (error: any) {
        if (error.name === 'Error') throw error;
        throw new Error(`❌ [Startup] Tenancy validation failed: ${error.message}`);
    }
};
