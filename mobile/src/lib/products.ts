const PRODUCT_NAME: Record<string, string> = {
  business_loan: 'Business loan',
  payday_loan: 'Payday loan',
  study_loan: 'Study loan',
  asset_loan: 'Asset loan',
  lpo_invoice_financing: 'Invoice financing',
};

/** Built-in names, else a readable version of the code ("agric_loan" → "Agric loan")
 * for products staff create in the admin portal. */
export const productName = (code: string) => {
  if (PRODUCT_NAME[code]) return PRODUCT_NAME[code];
  const words = code.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
