/**
 * Formats paise into Indian Rupee currency format (e.g. ₹1,24,500.00)
 */
export function formatPaise(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0.00';
  }

  const rupees = paise / 100;

  // Intl NumberFormat with en-IN locale
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

