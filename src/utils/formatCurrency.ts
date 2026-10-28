/**
 * Utility to format numbers and currency cleanly across the app,
 * preventing layout overflows for large numbers (e.g. Lakhs, Crores, Millions)
 * and providing locale-aware comma separation.
 */

export function formatAmount(
  amount: number | string,
  symbol: string = '$',
  options: {
    compact?: boolean;
    decimals?: number;
    maxDecimals?: number;
    showSign?: boolean;
  } = {}
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) return `${symbol}0`;

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : options.showSign && num > 0 ? '+' : '';

  // Compact notation for large numbers if options.compact is enabled OR when amount >= 100,000,000
  if (options.compact || absNum >= 100_000_000) {
    if (symbol === '₹') {
      if (absNum >= 1_00_00_000) {
        return `${sign}${symbol}${(absNum / 1_00_00_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
      }
      if (absNum >= 1_00_000) {
        return `${sign}${symbol}${(absNum / 1_00_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
      }
      if (absNum >= 1_000) {
        return `${sign}${symbol}${(absNum / 1_000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k`;
      }
    } else {
      if (absNum >= 1_000_000_000) {
        return `${sign}${symbol}${(absNum / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`;
      }
      if (absNum >= 1_000_000) {
        return `${sign}${symbol}${(absNum / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
      }
      if (absNum >= 1_000) {
        return `${sign}${symbol}${(absNum / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`;
      }
    }
  }

  // Locale-aware standard formatting
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const decimalDigits = options.decimals !== undefined 
    ? options.decimals 
    : (absNum % 1 === 0 ? 0 : 2);

  const formattedNum = new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.maxDecimals !== undefined ? 0 : decimalDigits,
    maximumFractionDigits: options.maxDecimals !== undefined ? options.maxDecimals : 2,
  }).format(absNum);

  return `${sign}${symbol}${formattedNum}`;
}

export function getDynamicBalanceFontSize(textLength: number): string {
  if (textLength > 18) return 'text-[18px] sm:text-[22px] leading-tight';
  if (textLength > 14) return 'text-[22px] sm:text-[28px] leading-tight';
  if (textLength > 11) return 'text-[26px] sm:text-[32px] leading-tight';
  if (textLength > 8) return 'text-[32px] sm:text-[38px] leading-tight';
  return 'text-[38px] sm:text-[48px] leading-none';
}
