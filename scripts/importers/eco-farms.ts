/**
 * Vendor adapter: Eco-Farms Brisbane availability list (xlsx) -> Product + VendorPricing.
 *
 * Usage:
 *   pnpm import:eco-farms --file doc/wholesale-eco-farms.xlsx --date 2026-08-24 [--dry-run] [--sheet "Avail List"]
 *
 * This only knows how *this* vendor's spreadsheet is laid out. Everything vendor-agnostic
 * (schema, storage, unit-conversion math) lives in lib/vendor-pricing/ and is meant to be
 * reused by future vendor adapters (scripts/importers/<vendor>.ts).
 *
 * The sheet's header is "PRODUCT | SIZE | GROWER | CODE | CUSTOMER COMMENT... | ORDER QTY |
 * PICK QTY | PRICE | Multi Buy...", but "SIZE" is a merged header spanning two real columns:
 * a pack-type code (BX/EA/BG/TR/...) and the actual size value (5KG/1BN/PER KG/8X1KG/...).
 * Row layout confirmed by inspecting the real file — see the approved plan for column indices.
 */
import XLSX from 'xlsx';
import {
  computePricePerKg,
  deriveProductName,
  parsePackSize
} from '../../lib/vendor-pricing/normalize';
import {
  loadProducts,
  saveProducts,
  saveVendorPricing,
  upsertProduct,
  vendorPricingFileExists
} from '../../lib/vendor-pricing/store';
import type { Product, VendorPricing } from '../../lib/vendor-pricing/types';

const VENDOR_CODE = 'eco-farms';

// Section headings that aren't fresh produce — packaging, pantry/grocery lines, etc.
const SKIP_SECTION_PATTERN = /GROCERY|COMPOST|WISHLIST/i;

const COL = {
  product: 0,
  packType: 1,
  size: 2,
  grower: 3,
  code: 4,
  price: 8
} as const;

type Args = { file: string; date: string; sheet: string; dryRun: boolean };

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const file = get('--file');
  const date = get('--date');
  if (!file || !date) {
    console.error(
      'Usage: import:eco-farms --file <path.xlsx> --date <YYYY-MM-DD> [--dry-run] [--sheet "Avail List"]'
    );
    process.exit(1);
  }
  return {
    file,
    date,
    sheet: get('--sheet') ?? 'Avail List',
    dryRun: argv.includes('--dry-run')
  };
}

function isSectionHeaderRow(row: unknown[]): string | null {
  const [product, packType, , grower, code] = row;
  if (
    product == null &&
    packType == null &&
    grower == null &&
    typeof code === 'string' &&
    code.trim()
  ) {
    return code.trim();
  }
  return null;
}

function isDataRow(row: unknown[]): boolean {
  const product = row[COL.product];
  const price = row[COL.price];
  return (
    typeof product === 'string' &&
    product.trim() !== '' &&
    product.trim() !== 'PRODUCT' &&
    typeof price === 'number'
  );
}

function categoryForSection(section: string): Product['category'] {
  const upper = section.toUpperCase();
  return upper.includes('FRUIT') || upper.includes('DATES') ? 'Fruit' : 'Vegetables';
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && vendorPricingFileExists(VENDOR_CODE, args.date)) {
    console.error(
      `data/vendor-pricing/${VENDOR_CODE}/${args.date}.json already exists — refusing to overwrite. Pick a different --date.`
    );
    process.exit(1);
  }

  const workbook = XLSX.readFile(args.file);
  const sheet = workbook.Sheets[args.sheet];
  if (!sheet) {
    console.error(
      `Sheet "${args.sheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
    );
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });

  let products = loadProducts();
  const pricingRows: VendorPricing[] = [];

  let currentSection: string | null = null;
  const skippedSections = new Set<string>();
  let matchedExisting = 0;
  let createdProducts = 0;
  let priced = 0;
  let needsConversion = 0;
  let unparsedPackSize = 0;
  let rowIndex = 0;

  for (const row of rows) {
    const sectionName = isSectionHeaderRow(row);
    if (sectionName) {
      currentSection = sectionName;
      continue;
    }

    if (!isDataRow(row)) continue;
    if (!currentSection) continue;
    if (SKIP_SECTION_PATTERN.test(currentSection)) {
      skippedSections.add(currentSection);
      continue;
    }

    rowIndex++;
    const rawProduct = String(row[COL.product]).trim();
    const packType = row[COL.packType] != null ? String(row[COL.packType]).trim() : '';
    const sizeText = row[COL.size] != null ? String(row[COL.size]).trim() : '';
    const code = row[COL.code] != null ? String(row[COL.code]).trim() : '';
    const price = row[COL.price] as number;

    const parsed = parsePackSize(sizeText || packType);
    if (parsed.unparsed) unparsedPackSize++;

    const productName = deriveProductName(rawProduct);
    const category = categoryForSection(currentSection);
    const before = products.length;
    const upserted = upsertProduct(products, { name: productName, category });
    products = upserted.products;
    const product = upserted.product;
    if (products.length > before) createdProducts++;
    else matchedExisting++;

    const conversion = computePricePerKg(price, parsed.qty, parsed.unit, product.avgWeightG);
    if (conversion.needsConversionFactor) needsConversion++;
    else priced++;

    const rawLabel = `${rawProduct} — ${packType} ${sizeText}`.replace(/\s+/g, ' ').trim();
    const idSuffix = code ? code.toLowerCase().replace(/\s+/g, '-') : `row${rowIndex}`;

    pricingRows.push({
      id: `${product.id}__${VENDOR_CODE}__${args.date}__${idSuffix}`,
      productId: product.id,
      vendorCode: VENDOR_CODE,
      date: args.date,
      rawLabel,
      price,
      qty: parsed.qty,
      vendorUnit: parsed.unit,
      destinationUnit: 'kg',
      pricePerDestinationUnit: conversion.value,
      needsConversionFactor: conversion.needsConversionFactor
    });
  }

  console.log(`Parsed ${pricingRows.length} pricing rows from "${args.sheet}".`);
  console.log(`  Products: ${createdProducts} new, ${matchedExisting} matched existing.`);
  console.log(`  Priced directly (kg/g-denominated): ${priced}`);
  console.log(`  Needs a conversion factor (no avgWeightG yet): ${needsConversion}`);
  if (unparsedPackSize)
    console.log(`  ⚠ Unparsed pack-size text: ${unparsedPackSize} (check rawLabel on those rows)`);
  if (skippedSections.size)
    console.log(`  Skipped non-produce sections: ${[...skippedSections].join(', ')}`);

  if (args.dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  saveProducts(products);
  saveVendorPricing(VENDOR_CODE, args.date, pricingRows);
  console.log(
    `\nWrote data/products.json and data/vendor-pricing/${VENDOR_CODE}/${args.date}.json`
  );
}

main();
