import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { BranchService } from '../services/branchService';
import { ApiResponse } from '../utils/ApiResponse';

// ─── GET /api/branches ─────────────────────────────────────────────────────────
export const getAllBranches = asyncHandler(async (_req: Request, res: Response) => {
    const branches = await BranchService.getAllBranches();
    res.status(200).json(new ApiResponse('Branches fetched successfully.', branches));
});

// ─── GET /api/branches/:id ────────────────────────────────────────────────────
export const getBranchById = asyncHandler(async (req: Request, res: Response) => {
    const branch = await BranchService.getBranchById(req.params.id as string);
    res.status(200).json(new ApiResponse('Branch fetched successfully.', branch));
});

// ─── POST /api/branches (admin) ────────────────────────────────────────────────
export const createBranch = asyncHandler(async (req: Request, res: Response) => {
    const branch = await BranchService.createBranch(req.body);
    res.status(201).json(new ApiResponse('Branch created successfully.', branch));
});

// ─── PATCH /api/branches/:id (admin) ───────────────────────────────────────────
export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
    const branch = await BranchService.updateBranch(req.params.id as string, req.body);
    res.status(200).json(new ApiResponse('Branch updated successfully.', branch));
});

// ─── DELETE /api/branches/:id (admin) ──────────────────────────────────────────
export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
    await BranchService.deleteBranch(req.params.id as string);
    res.status(200).json(new ApiResponse('Branch deleted successfully.', null));
});

// ─── GET /api/branches/:id/tables ──────────────────────────────────────────────
export const getBranchTables = asyncHandler(async (req: Request, res: Response) => {
    const tables = await BranchService.getBranchTables(req.params.id as string);
    res.status(200).json(new ApiResponse('Branch tables fetched successfully.', tables));
});
