import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  mrpPaise: number;
  unit: string;
  stock: number;
  maxPerOrder: number;
  tags: string[];
}

export interface PincodeEntry {
  pincode: string;
  area: string;
  city: string;
  etaMinutes: number;
  deliveryFeePaise: number;
}

export interface PromoEntry {
  code: string;
  description: string;
  discountType: 'percentage' | 'flat' | 'free_delivery';
  value: number;
  minSubtotalPaise: number;
  maxDiscountPaise?: number;
  firstOrderOnly?: boolean;
  exclusiveGroup?: string;
  active: boolean;
  expired?: boolean;
}

export interface SeedData {
  products: Product[];
  promos: PromoEntry[];
  pincodes: PincodeEntry[];
}

function resolveSeedPath(filename: string): string {
  // Check relative to server/seed first, then root/server/seed
  const candidates = [
    path.resolve(__dirname, '../../seed', filename),
    path.resolve(process.cwd(), 'server/seed', filename),
    path.resolve(process.cwd(), 'seed', filename),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(`Seed file not found: ${filename}. Checked: ${candidates.join(', ')}`);
}

export function loadSeedData(): SeedData {
  const productsPath = resolveSeedPath('products.json');
  const promosPath = resolveSeedPath('promos.json');
  const pincodesPath = resolveSeedPath('pincodes.json');

  const products: Product[] = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  const promos: PromoEntry[] = JSON.parse(fs.readFileSync(promosPath, 'utf8'));
  const pincodes: PincodeEntry[] = JSON.parse(fs.readFileSync(pincodesPath, 'utf8'));

  return {
    products,
    promos,
    pincodes,
  };
}

// Standalone runner for `npm run seed:check`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = loadSeedData();
  console.info(`Seed verified successfully:`);
  console.info(`  - Products: ${data.products.length} items`);
  console.info(`  - Promos: ${data.promos.length} codes`);
  console.info(`  - Pincodes: ${data.pincodes.length} serviceable areas`);
}
