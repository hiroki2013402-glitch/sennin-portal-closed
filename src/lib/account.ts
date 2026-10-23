import type { AccountUser } from '../types';

export function displayName(user?: AccountUser | null): string {
  return String(user?.name || user?.username || user?.email || 'ユーザー');
}

export function displayInitial(name: string): string {
  return name.slice(0, 1).toUpperCase();
}
