import { Types } from 'mongoose';

/**
 * Validates if a string is a valid MongoDB ObjectId.
 * Prevents CastErrors when querying with malformed strings.
 */
export const isValidObjectId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    return Types.ObjectId.isValid(id);
};

/**
 * Ensures a string is a valid ObjectId, otherwise returns undefined.
 */
export const safeObjectId = (id: string | null | undefined): string | undefined => {
    return isValidObjectId(id) ? (id as string) : undefined;
};
