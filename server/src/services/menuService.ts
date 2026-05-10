import AppError from '../utils/AppError';
import ApiFeatures from '../utils/apiFeatures';
import MenuItemModel from '../models/MenuItem';
import { uploadImage, deleteImage } from './cloudinaryService';
import { MenuRepository } from '../repositories/menu.repository';

export class MenuService {

    static async getAllMenuItems(query: Record<string, string>) {
        // ApiFeatures wraps the Mongoose query builder — requires the raw model query
        const baseQuery = MenuItemModel.find({ isAvailable: true }).populate('category', 'name image');
        const features = new ApiFeatures(baseQuery, query)
            .filter()
            .search()
            .sort()
            .limitFields()
            .paginate();

        const items = await features.query;
        const total = await MenuRepository.countAvailable();
        return { items, total, results: items.length };
    }

    static async getFeaturedItems() {
        const items = await MenuRepository.findFeatured();
        return { items, results: items.length };
    }

    static async getDealsItems() {
        const items = await MenuRepository.findDeals();
        return { items, results: items.length };
    }

    static async getMenuItem(id: string) {
        const item = await MenuRepository.findById(id);
        if (!item || !item.isAvailable) throw new AppError('Menu item not found.', 404);
        return item;
    }

    static async createMenuItem(adminId: string, body: Record<string, unknown>, fileBuffer: Buffer) {
        const branch = await MenuRepository.findRestaurantByOwner(adminId);
        if (!branch) {
            throw new AppError('No branch found for this admin. Please contact support.', 404);
        }

        const uploadResult = await uploadImage(fileBuffer, 'restaurant/menu');

        if (typeof body.ingredients === 'string') {
            try { body.ingredients = JSON.parse(body.ingredients as string); } catch { body.ingredients = []; }
        }
        if (typeof body.tags === 'string') {
            try { body.tags = JSON.parse(body.tags as string); } catch { body.tags = []; }
        }

        return MenuRepository.create({ ...body, image: uploadResult, branchId: branch._id });
    }

    static async updateMenuItem(id: string, body: Record<string, unknown>, fileBuffer?: Buffer) {
        const item = await MenuRepository.findById(id);
        if (!item) throw new AppError('Menu item not found.', 404);

        if (fileBuffer) {
            if (item.image?.public_id) await deleteImage(item.image.public_id);
            body.image = await uploadImage(fileBuffer, 'restaurant/menu');
        }

        return MenuRepository.updateById(id, body);
    }

    static async deleteMenuItem(id: string) {
        const item = await MenuRepository.findById(id);
        if (!item) throw new AppError('Menu item not found.', 404);

        if (item.image?.public_id) await deleteImage(item.image.public_id);
        await MenuRepository.deleteById(id);
        return null;
    }
}
