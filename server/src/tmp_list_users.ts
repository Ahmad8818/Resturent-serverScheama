import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const listUsers = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not defined');
    
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      role: String,
      name: String
    }));
    
    const users = await User.find({ role: 'admin' });
    console.log('Admin Users:');
    users.forEach(u => console.log(`- ${u.name} (${u.email})`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listUsers();
