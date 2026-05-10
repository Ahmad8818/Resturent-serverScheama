import { Request, Response } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { UserService } from '../services/userService';
import { ApiResponse } from '../utils/ApiResponse';

// ─── GET /api/users ───────────────────────────────────────────────────────────
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const users = await UserService.getAllUsers(req.query, req.user);
    res.status(200).json(new ApiResponse('Users fetched successfully.', users));
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.getUser(req.params.id as string);
    res.status(200).json(new ApiResponse('User fetched successfully.', user));
});

// ─── PATCH /api/users/:id/status ──────────────────────────────────────────────
export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.updateUserStatus(req.params.id as string, req.body.status, req.user);
    res.status(200).json(new ApiResponse(`User status updated to ${req.body.status}.`, user));
});

// ─── POST /api/users/staff ────────────────────────────────────────────────────
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.createStaff(req.body, req.user);
    res.status(201).json(new ApiResponse('Staff member created successfully.', user));
});

// ─── GET /api/users/search ─────────────────────────────────────────────────────
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string | undefined;
    const users = await UserService.searchUsers(q || '', req.user);
    res.status(200).json(new ApiResponse('Users found.', users));
});

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    await UserService.deleteUser(req.params.id as string, req.user);
    res.status(200).json(new ApiResponse('User successfully deleted.', null));
});

// ─── PATCH /api/users/:id/update ─────────────────────────────────────────────
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.updateUser(req.params.id as string, req.body, req.user);
    res.status(200).json(new ApiResponse('User updated successfully.', user));
});
