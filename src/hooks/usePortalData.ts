import { useCallback, useEffect, useState } from 'react';
import type { AccountUser } from '../types';
import { getPoints, getSession } from '../lib/api';

export function usePortalData() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [pointsMessage, setPointsMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const session = await getSession();
      if (!session.authenticated || !session.user) {
        setUser(null);
        setPoints(null);
        setPointsMessage('');
        return;
      }

      setUser(session.user);
      try {
        const result = await getPoints();
        const candidate = result.points ?? result.balance ?? result.total;
        setPoints(typeof candidate === 'number' ? candidate : null);
        setPointsMessage(typeof candidate === 'number' ? '' : 'ポイントAPIの返却形式を確認してください');
      } catch {
        setPoints(null);
        setPointsMessage('ポイントを取得できませんでした');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '情報を取得できませんでした');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, points, pointsMessage, loading, error, refresh };
}
