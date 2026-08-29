import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';
import mongoose from 'mongoose';

const categories = [
  { id: 'textbooks', label: 'Textbooks', accent: 'text-acid' },
  { id: 'dorm', label: 'Dorm & furniture', accent: 'text-grape' },
  { id: 'tech', label: 'Tech', accent: 'text-sky' },
  { id: 'kitchen', label: 'Kitchen', accent: 'text-tangerine' },
  { id: 'rides', label: 'Rides & bikes', accent: 'text-rose' },
  { id: 'free', label: 'Free stuff', accent: 'text-acid' }
];

async function run() {
  await connectDB();
  for (const cat of categories) {
    await Category.findOneAndUpdate({ id: cat.id }, cat, { upsert: true });
  }
  console.log(`Seeded ${categories.length} categories`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
