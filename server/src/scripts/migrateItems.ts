import mongoose from 'mongoose';
import 'dotenv/config';
import RestaurantModel from '../models/Restaurant';
import MenuItemModel from '../models/MenuItem';
import OrderModel from '../models/Order';
import UserModel from '../models/User';

/**
 * PRODUCTION DATA MIGRATION (Phase 1.4)
 * Purpose: Link existing single-tenant data to a default Restaurant for multi-tenant support.
 */
async function migrateToMultiTenant() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resturent';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for migration...');

        // 1. Find a default admin for the restaurant owner
        const admin = await UserModel.findOne({ role: 'admin' });
        if (!admin) {
            console.error('No admin user found. Create an admin first.');
            process.exit(1);
        }

        // 2. Create Default Restaurant
        let defaultRestaurant = await RestaurantModel.findOne({ name: 'The Main Kitchen' });
        if (!defaultRestaurant) {
            defaultRestaurant = await RestaurantModel.create({
                name: 'The Main Kitchen',
                description: 'Default restaurant for migrated data',
                owner: admin._id,
                location: 'Downtown City',
            });
            console.log('Created Default Restaurant:', defaultRestaurant.name);
        }

        // 3. Migrate Menu Items
        const menuResult = await MenuItemModel.updateMany(
            { restaurant: { $exists: false } },
            { $set: { restaurant: defaultRestaurant._id } }
        );
        console.log(`Migrated ${menuResult.modifiedCount} Menu Items.`);

        // 4. Migrate Orders
        const orderResult = await OrderModel.updateMany(
            { restaurant: { $exists: false } },
            { $set: { restaurant: defaultRestaurant._id } }
        );
        console.log(`Migrated ${orderResult.modifiedCount} Orders.`);

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateToMultiTenant();
