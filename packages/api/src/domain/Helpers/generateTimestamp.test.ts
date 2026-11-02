import { describe, expect, it } from 'bun:test';

// Pure function - timestamp generation
const generateTimestamp = (now: Date): string => {
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

describe('generateTimestamp', () => {
    it('should format timestamp with zero-padded values', () => {
        const date = new Date(2025, 0, 5, 8, 3, 7); // Jan 5, 2025 8:03:07 AM
        const result = generateTimestamp(date);
        expect(result).toBe('2025-01-05 08:03:07');
    });

    it('should handle single-digit month', () => {
        const date = new Date(2025, 2, 15, 10, 30, 45); // Mar 15, 2025
        const result = generateTimestamp(date);
        expect(result).toBe('2025-03-15 10:30:45');
    });

    it('should handle single-digit day', () => {
        const date = new Date(2025, 11, 1, 14, 20, 10); // Dec 1, 2025
        const result = generateTimestamp(date);
        expect(result).toBe('2025-12-01 14:20:10');
    });

    it('should handle single-digit hour, minute, second', () => {
        const date = new Date(2025, 5, 9, 1, 2, 3); // Jun 9, 2025 1:02:03 AM
        const result = generateTimestamp(date);
        expect(result).toBe('2025-06-09 01:02:03');
    });

    it('should handle midnight', () => {
        const date = new Date(2025, 0, 1, 0, 0, 0); // Jan 1, 2025 00:00:00
        const result = generateTimestamp(date);
        expect(result).toBe('2025-01-01 00:00:00');
    });

    it('should handle end of day', () => {
        const date = new Date(2025, 11, 31, 23, 59, 59); // Dec 31, 2025 23:59:59
        const result = generateTimestamp(date);
        expect(result).toBe('2025-12-31 23:59:59');
    });

    it('should handle leap year February 29', () => {
        const date = new Date(2024, 1, 29, 12, 0, 0); // Feb 29, 2024 (leap year)
        const result = generateTimestamp(date);
        expect(result).toBe('2024-02-29 12:00:00');
    });

    it('should maintain correct format YYYY-MM-DD HH:MM:SS', () => {
        const date = new Date(2025, 6, 15, 16, 45, 30); // Jul 15, 2025
        const result = generateTimestamp(date);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should work with different years', () => {
        const date2020 = generateTimestamp(new Date(2020, 0, 1, 0, 0, 0));
        const date2030 = generateTimestamp(new Date(2030, 0, 1, 0, 0, 0));

        expect(date2020).toContain('2020');
        expect(date2030).toContain('2030');
    });

    it('should work with all months', () => {
        for (let month = 0; month < 12; month++) {
            const date = new Date(2025, month, 15, 12, 0, 0);
            const result = generateTimestamp(date);
            const monthStr = (month + 1).toString().padStart(2, '0');
            expect(result).toContain(`-${monthStr}-`);
        }
    });

    it('should work with various days in month', () => {
        const testDays = [1, 5, 10, 15, 20, 25, 28, 31];

        for (const day of testDays) {
            const date = new Date(2025, 0, day, 12, 0, 0);
            const result = generateTimestamp(date);
            const dayStr = day.toString().padStart(2, '0');
            expect(result).toContain(`-${dayStr} `);
        }
    });
});
