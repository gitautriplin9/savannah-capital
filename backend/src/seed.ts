import { seedInitialData } from './db.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Seeded test accounts must not be created in production.');
}

seedInitialData();
console.log('Seeded account data is ready.');
