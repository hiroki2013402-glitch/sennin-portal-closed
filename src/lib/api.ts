import type { SessionResponse } from '../types';

export type PointsResponse = {
  points?: number;
  balance?: number;
  total?: number;
  point_balance?: number | string;
  available_points?: number | string;
  current_points?: number | string;
  point?: number | string;
  [key: string]: unknown;
};

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? 'ログインが必要です。' : `APIエラー (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function getSession(): Promise<SessionResponse> {
  return getJson<SessionResponse>('/api/session');
}

export async function getPoints(): Promise<PointsResponse> {
  return getJson<PointsResponse>('/api/points');
}
