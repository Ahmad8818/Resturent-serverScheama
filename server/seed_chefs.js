/**
 * seed_chefs.js
 * Run once: node seed_chefs.js
 * Creates 2 demo kitchen chefs (idempotent - skips if already exists).
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const BRANCH_ID = process.env.DEFAULT_BRANCH_ID || '69deb0e9daf0e34859961806';

const demoChefs = [
    {
        name: 'Chef Ahmed',
        email: 'chefA@restaurant.com',
        password: 'Chef@1234',
        role: 'kitchen',
        activeOrdersCount: 0,
        maxCapacity: 2,
        onDuty: true,
        isAvailable: true,
        verify_email: true,
        status: 'Active',
        signUpWithGoogle: false,
        order_history: [],
        branchId: { $oid: BRANCH_ID },
    },
    {
        name: 'Chef Sara',
        email: 'chefB@restaurant.com',
        password: 'Chef@1234',
        role: 'kitchen',
        activeOrdersCount: 0,
        maxCapacity: 2,
        onDuty: true,
        isAvailable: true,
        verify_email: true,
        status: 'Active',
        signUpWithGoogle: false,
        order_history: [],
        branchId: { $oid: BRANCH_ID },
    },
];

async function seed() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const users = db.collection('resturentusers');

        let created = 0;
        let skipped = 0;

        for (const chef of demoChefs) {
            const existing = await users.findOne({ email: chef.email });
            if (existing) {
                console.log(`⏭  Skipping "${chef.name}" — already exists (${chef.email})`);
                skipped++;
                continue;
            }

            // Hash password
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(chef.password, salt);

            const { $oid, ...branchIdRaw } = chef.branchId;
            const { MongoClient: _, ...rest } = require('mongodb');
            const { ObjectId } = require('mongodb');

            await users.insertOne({
                ...chef,
                password: hashedPassword,
                branchId: new ObjectId(BRANCH_ID),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            console.log(`✅ Created chef: ${chef.name} (${chef.email})`);
            created++;
        }

        console.log(`\n📊 Seeding complete: ${created} created, ${skipped} skipped.`);
        console.log('\n🔐 Login credentials:');
        demoChefs.forEach(c => console.log(`   ${c.name}: ${c.email} / ${c.password}`));

    } catch (err) {
        console.error('❌ Seed failed:', err);
    } finally {
        await client.close();
    }
}

seed();
