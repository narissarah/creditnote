/**
 * Utility functions for consistent date formatting
 * to avoid hydration mismatches between server and client
 */

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: string | Date | null): string {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    // Use ISO string and extract date part for consistency
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format date and time as YYYY-MM-DD HH:MM
 */
export function formatDateTime(date: string | Date | null): string {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    // Use ISO string and format consistently
    const iso = d.toISOString();
    const [datePart, timePart] = iso.split('T');
    const [time] = timePart.split('.');
    const [hours, minutes] = time.split(':');
    
    return `${datePart} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}