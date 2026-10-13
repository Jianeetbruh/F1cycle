import crypto from 'crypto';
const pin = process.argv[2];
if (!pin) throw new Error('Usage: npx tsx scripts/hash-pin.ts <pin>');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
console.log(`${salt}$${hash}`);
