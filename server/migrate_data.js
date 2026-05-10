const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function migrate() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();
        const branchId = '69deb0e9daf0e34859961806'; // Valid Branch ID

        // 1. Migrate Orders
        console.log('Migrating Orders...');
        const ordersResult = await db.collection('resturentorders').updateMany(
            {},
            [
                {
                    $set: {
                        branchId: new ObjectId(branchId),
                    }
                },
                {
                    $unset: 'restaurant'
                }
            ]
        );
        console.log(`Updated ${ordersResult.modifiedCount} orders.`);

        // 2. Migrate MenuItems
        console.log('Migrating MenuItems...');
        const menuResult = await db.collection('menuitems').updateMany(
            {},
            [
                {
                    $set: {
                        branchId: new ObjectId(branchId),
                    }
                },
                {
                    $unset: 'restaurant'
                }
            ]
        );
        console.log(`Updated ${menuResult.modifiedCount} menu items.`);

        // 3. Migrate Users (Staff)
        console.log('Migrating Users (Staff association)...');
        const userResult = await db.collection('resturentusers').updateMany(
            { role: { $nin: ['user', 'admin'] } },
            [
                {
                    $set: {
                        branchId: new ObjectId(branchId),
                    }
                },
                {
                    $unset: 'restaurant'
                }
            ]
        );
        console.log(`Updated ${userResult.modifiedCount} users.`);

        console.log('✅ Migration completed successfully.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrate();
