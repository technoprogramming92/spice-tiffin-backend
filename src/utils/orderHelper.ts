// src/utils/orderHelper.ts

/**
 * Generates a unique order number.
 * Example format: SBO-YYYYMMDD-HHMMSS-XXXX (SpiceBar Order - Date - Time - Random)
 * This is a simple version; for high-concurrency systems, a more robust
 * UUID generator or a database sequence might be preferred.
 * @returns {string} A generated order number.
 */
export const generateOrderNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  // Generate a short random alphanumeric string (4 characters)
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `SBO-${year}${month}${day}-${hours}${minutes}${seconds}-${randomPart}`;
};
