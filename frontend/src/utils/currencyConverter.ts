import { Country } from '@/utils/aiProductMatcher';

// Simple currency conversion rates (INR as base)
// In production, use a real currency API (openexchangerates.org, etc.)
const EXCHANGE_RATES: Record<Country, number> = {
  IN: 1, // Base currency
  US: 0.012, // 1 INR = 0.012 USD (approximate)
  UK: 0.0096, // 1 INR = 0.0096 GBP
  AE: 0.044, // 1 INR = 0.044 AED
  DE: 0.011, // 1 INR = 0.011 EUR
};

// Convert price from one country's currency to another
export function convertCurrency(
  price: number | undefined,
  fromCountry: Country,
  toCountry: Country
): number | undefined {
  if (!price) return undefined;
  if (fromCountry === toCountry) return price;

  // Convert to base (INR) then to target
  const inBaseCurrency = price / EXCHANGE_RATES[fromCountry];
  const inTargetCurrency = inBaseCurrency * EXCHANGE_RATES[toCountry];

  return Math.round(inTargetCurrency * 100) / 100; // Round to 2 decimals
}
