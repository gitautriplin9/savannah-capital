export { BRAND } from '../../brand';

export const kes = (value: number) => `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
export const phone = (value: string) => value.replace(/^(?:\+?254|0)(\d{3})(\d{3})(\d{3})$/, '+254 $1 $2 $3');
