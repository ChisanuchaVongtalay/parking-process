export function normalizeAdminEmail(email: string): string;
export function isAdminEmail(email: string): boolean;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, stored?: string): Promise<boolean>;
