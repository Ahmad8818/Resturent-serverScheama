import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const verifyDeletion = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not defined');
    
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    // Check Menu Item (Spicy Beef Pizza)
    const MenuItem = mongoose.model('MenuItem', new mongoose.Schema({
        name: String,
        isAvailable: Boolean
    }, { collection: 'menuitems' }));
    
    const pizza = await MenuItem.findOne({ name: 'Spicy Beef Pizza' });
    if (!pizza) {
        console.log('✅ Spicy Beef Pizza: Record NOT FOUND (Permanently Deleted)');
    } else if (pizza.isAvailable === false) {
        console.log('✅ Spicy Beef Pizza: Record FOUND but isAvailable is FALSE (Soft Deleted)');
    } else {
        console.log('❌ Spicy Beef Pizza: Record FOUND and isAvailable is TRUE (Delete Failed)');
    }
    
    // Check Category (Admin Test)
    // Assuming Category also has a soft delete or is hard deleted.
    // I will check the model just in case.
    const Category = mongoose.model('Category', new mongoose.Schema({
        name: String,
        isActive: Boolean
    }));
    
    const category = await Category.findOne({ name: 'Admin Test' });
    if (!category) {
        console.log('✅ Admin Test Category: Record NOT FOUND (Permanently Deleted)');
    } else {
        console.log('❌ Admin Test Category: Record FOUND (Delete Failed)');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

verifyDeletion();
