import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import compression from 'compression';
import helmet from 'helmet';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type OAuthUser = Record<string, unknown> & { sub?: string; id?: string; user_id?: string; name?: string; username?: string; email?: string };
type OAuthTokens = { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string };
declare module 'express-session' {
  interface SessionData {
    oauthState?: string;
    codeVerifier?: string;
    user?: OAuthUser;
    tokens?: OAuthTokens;
    tokenExpiresAt?: number;
  }
}

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const appOrigin = requiredEnv('APP_ORIGIN');
const apiBase = (process.env.OAUTH_API_BASE_URL || 'https://sennin-account-api.xianrendesu.workers.dev').replace(/\/+$/, '');
const tokenUrl = process.env.OAUTH_TOKEN_URL || `${apiBase}/oauth/token`;
const userInfoUrl = process.env.OAUTH_USERINFO_URL || `${apiBase}/oauth/userinfo`;
const pointsUrl = process.env.OAUTH_POINTS_URL || `${apiBase}/api/v1/points`;
const authorizeUrl = requiredEnv('OAUTH_AUTHORIZE_URL');
const clientId = requiredEnv('OAUTH_CLIENT_ID');
const redirectUri = requiredEnv('OAUTH_REDIRECT_URI');
const sessionSecret = requiredEnv('SESSION_SECRET');
const clientSecret = process.env.OAUTH_CLIENT_SECRET || '';
const authMethod = process.env.OAUTH_CLIENT_AUTH_METHOD || 'client_secret_basic';
const scopes = (process.env.OAUTH_SCOPES || 'profile email').trim();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
if (authMethod !== 'client_secret_basic' && authMethod !== 'client_secret_post') {
  throw new Error('OAUTH_CLIENT_AUTH_METHOD must be client_secret_basic or client_secret_post.');
}
if (authMethod === 'client_secret_basic' && !clientSecret) {
  console.warn('OAUTH_CLIENT_SECRET is empty. This may work only if the registered OAuth client is public and the server permits it.');
}
if (isProduction) app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: 'sennin.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
function randomUrlSafe(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function oauthClientHeaders(): HeadersInit {
  if (authMethod === 'client_secret_basic' && clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    return { Authorization: `Basic ${credentials}`, Accept: 'application/json' };
  }
  return { Accept: 'application/json' };
}
function tokenForm(values: Record<string, string>): URLSearchParams {
  const form = new URLSearchParams(values);
  if (authMethod === 'client_secret_post' && clientSecret) {
    form.set('client_secret', clientSecret);
  }
  return form;
}
async function parseResponse(response: globalThis.Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  let parsed: unknown = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = { message: body.slice(0, 500) }; }
  if (!response.ok) {
    const err = new Error(`Sennin Account API returned ${response.status}`);
    (err as Error & { status?: number; details?: unknown }).status = response.status;
    (err as Error & { status?: number; details?: unknown }).details = parsed;
    throw err;
  }
  return (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
}
async function exchangeToken(form: URLSearchParams): Promise<OAuthTokens> {
  const headers = new Headers(oauthClientHeaders());
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  const response = await fetch(tokenUrl, { method: 'POST', headers, body: form });
  const data = await parseResponse(response);
  const payload = (data.data && typeof data.data === 'object' ? data.data : data.token && typeof data.token === 'object' ? data.token : data) as Record<string, unknown>;
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error('Token response did not include access_token. Check the live OAuth API response and client configuration.');
  }
  return payload as OAuthTokens;
}
async function fetchUserInfo(accessToken: string): Promise<OAuthUser> {
  const response = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  const raw = await parseResponse(response);
  const nested = (raw.user && typeof raw.user === 'object' ? raw.user : raw.profile && typeof raw.profile === 'object' ? raw.profile : raw.data && typeof raw.data === 'object' ? raw.data : raw) as Record<string, unknown>;
  const id = nested.id ?? nested.user_id ?? nested.userId ?? nested.userID ?? nested.sub ?? nested.uid;
  if (id === undefined || id === null || String(id).trim() === '') throw new Error('UserInfo response did not include id/user_id/sub.');
  return { ...nested, id: String(id), sub: String(nested.sub ?? id), username: String(nested.username ?? nested.name ?? ''), name: String(nested.name ?? nested.username ?? 'ユーザー') } as OAuthUser;
}
async function refreshTokens(req: Request): Promise<boolean> {
  const current = req.session.tokens;
  if (!current?.refresh_token) return false;
  const form = tokenForm({
    grant_type: 'refresh_token',
    refresh_token: current.refresh_token,
    client_id: clientId
  });
  try {
    const next = await exchangeToken(form);
    req.session.tokens = next;
    req.session.tokenExpiresAt = Date.now() + (Number(next.expires_in) || 3600) * 1000;
    return true;
  } catch {
    return false;
  }
}
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.tokens?.access_token) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }
  if (req.session.tokenExpiresAt && Date.now() >= req.session.tokenExpiresAt - 30_000) {
    const refreshed = await refreshTokens(req);
    if (!refreshed) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: 'session_expired' });
      return;
    }
  }
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/session', (req, res) => {
  if (!req.session.user || !req.session.tokens?.access_token) {
    res.json({ authenticated: false });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ authenticated: true, user: req.session.user });
});

app.get('/auth/login', (req, res) => {
  const state = randomUrlSafe(32);
  const verifier = randomUrlSafe(48);
  req.session.oauthState = state;
  req.session.codeVerifier = verifier;

  const target = new URL(authorizeUrl);
  target.searchParams.set('response_type', 'code');
  target.searchParams.set('client_id', clientId);
  target.searchParams.set('redirect_uri', redirectUri);
  target.searchParams.set('scope', scopes);
  target.searchParams.set('state', state);
  target.searchParams.set('code_challenge', pkceChallenge(verifier));
  target.searchParams.set('code_challenge_method', 'S256');
  res.redirect(target.toString());
});

app.get('/auth/callback', async (req, res) => {
  const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
  const expectedState = req.session.oauthState;
  const verifier = req.session.codeVerifier;
  delete req.session.oauthState;
  delete req.session.codeVerifier;

  if (oauthError) {
    res.status(400).send(`Sennin Accountの認証が完了しませんでした。エラー: ${escapeHtml(oauthError)}。ログインをやり直してください。`);
    return;
  }
  if (!expectedState || !returnedState || !safeEqual(expectedState, returnedState) || !verifier || !code) {
    res.status(400).send('OAuth callback validation failed (state/code/PKCE). ログインを最初からやり直してください。');
    return;
  }

  try {
    const form = tokenForm({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier
    });
    const tokens = await exchangeToken(form);
    const user = await fetchUserInfo(tokens.access_token);
    req.session.regenerate(err => {
      if (err) {
        res.status(500).send('セッションを開始できませんでした。');
        return;
      }
      req.session.tokens = tokens;
      req.session.user = user;
      req.session.tokenExpiresAt = Date.now() + (Number(tokens.expires_in) || 3600) * 1000;
      req.session.save(saveErr => {
        if (saveErr) {
          res.status(500).send('ログイン状態を保存できませんでした。');
          return;
        }
        res.redirect(new URL('/', appOrigin).toString());
      });
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    console.error('OAuth callback failed:', error instanceof Error ? error.message : 'unknown error', status || '');
    res.status(502).send('Sennin Accountとの連携に失敗しました。client設定、redirect URI、PKCE、OAuth APIのレスポンスを確認してください。秘密情報はログに出力していません。');
  }
});

app.get('/api/points', requireAuth, async (req, res) => {
  try {
    const response = await fetch(pointsUrl, {
      headers: { Authorization: `Bearer ${req.session.tokens!.access_token}`, Accept: 'application/json' }
    });
    const data = await parseResponse(response);
    const nested = (data.data && typeof data.data === 'object' ? data.data : data.points && typeof data.points === 'object' ? data.points : data) as Record<string, unknown>;
    const rawPoints = nested.points ?? nested.balance ?? nested.total ?? nested.point_balance ?? nested.available_points ?? nested.current_points ?? nested.point;
    const points = typeof rawPoints === 'number' ? rawPoints : (typeof rawPoints === 'string' && rawPoints.trim() !== '' ? Number(rawPoints) : NaN);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...data, points: Number.isFinite(points) ? points : undefined, user_id: String(req.session.user?.id ?? req.session.user?.user_id ?? req.session.user?.sub ?? '') });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 502;
    res.status(status).json({ error: 'points_unavailable', message: 'ポイントAPIから情報を取得できませんでした。' });
  }
});

app.post('/api/chat/messages', requireAuth, async (req, res) => {
  const user = req.session.user!;
  const userId = String(user.id ?? user.user_id ?? user.sub ?? '');
  const username = String(user.username ?? user.name ?? 'ユーザー').slice(0, 60);
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.trim().slice(0, 160) : 'general';
  if (!/^(general|group:[^\s]{1,100}|dm:[^\s]{1,140})$/.test(roomId)) { res.status(400).json({ error: 'invalid_room', message: 'チャットルームが正しくありません。' }); return; }
  if (!userId) { res.status(401).json({ error: 'account_user_id_missing' }); return; }
  if (!content || content.length > 1000) { res.status(400).json({ error: 'invalid_message', message: 'メッセージは1〜1000文字で入力してください。' }); return; }
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) { res.status(503).json({ error: 'chat_not_configured', message: 'チャットのサーバー設定が不足しています。' }); return; }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/portal_messages`, {
      method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, username, content, room_id: roomId }), signal: AbortSignal.timeout(8000)
    });
    const body = await response.text();
    if (!response.ok) { console.error('Supabase chat insert failed:', response.status, body.slice(0, 300)); res.status(502).json({ error: 'chat_insert_failed', message: 'メッセージを保存できませんでした。' }); return; }
    const rows = body ? JSON.parse(body) as unknown : [];
    res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
  } catch (error) { console.error('Supabase chat error:', error instanceof Error ? error.message : 'unknown'); res.status(502).json({ error: 'chat_unavailable', message: 'チャットサーバーに接続できませんでした。' }); }
});

const youtubeApiKey = process.env.YOUTUBE_DATA_API_KEY || '';
const invidiousInstances = (process.env.YOUTUBE_INVIDIOUS_INSTANCES || 'https://inv.nboeck.de,https://yewtu.be,https://iv.ggtyler.dev').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
app.get('/api/youtube/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 150) : '';
  const maxResults = Math.min(25, Math.max(1, Number(req.query.limit) || 12));
  if (!q) { res.status(400).json({ error: 'query_required', items: [] }); return; }
  res.setHeader('Cache-Control', 'no-store');
  if (youtubeApiKey) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.search = new URLSearchParams({ part: 'snippet', type: 'video', q, maxResults: String(maxResults), key: youtubeApiKey }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const data = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; description?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } }; publishedAt?: string } }> };
        const items = (data.items || []).filter(x => x.id?.videoId).map(x => ({ videoId: x.id!.videoId, title: x.snippet?.title || 'タイトルなし', channelTitle: x.snippet?.channelTitle || '', description: x.snippet?.description || '', thumbnail: x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.high?.url || x.snippet?.thumbnails?.default?.url || '', publishedAt: x.snippet?.publishedAt || '', source: 'youtube' }));
        res.json({ source: 'youtube', items }); return;
      }
      console.warn('YouTube Data API returned', response.status, 'trying Invidious fallback');
    } catch (error) { console.warn('YouTube Data API unavailable; trying Invidious fallback:', error instanceof Error ? error.message : 'unknown'); }
  }
  for (const instance of invidiousInstances) {
    try {
      const url = new URL(`${instance}/api/v1/search`); url.searchParams.set('q', q); url.searchParams.set('type', 'video');
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json() as Array<Record<string, unknown>>;
      const items = data.filter(x => typeof x.videoId === 'string').slice(0, maxResults).map(x => ({ videoId: String(x.videoId), title: String(x.title || 'タイトルなし'), channelTitle: String(x.author || ''), description: String(x.description || ''), thumbnail: String(x.videoThumbnails && Array.isArray(x.videoThumbnails) ? ((x.videoThumbnails as Array<Record<string, unknown>>).find(t => t.quality === 'medium')?.url || (x.videoThumbnails as Array<Record<string, unknown>>)[0]?.url || '') : ''), publishedAt: '', source: 'invidious' }));
      res.json({ source: 'invidious', items }); return;
    } catch { /* try next public instance */ }
  }
  res.status(502).json({ error: 'youtube_search_unavailable', message: 'YouTube APIとInvidiousの両方で検索できませんでした。APIキーや接続先を確認してください。', items: [] });
});

app.post('/logout', (req, res) => {
  const tokens = req.session.tokens;
  const finish = () => req.session.destroy(() => {
    res.clearCookie('sennin.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
    res.redirect(new URL('/', appOrigin).toString());
  });
  if (!tokens?.access_token) {
    finish();
    return;
  }
  const form = tokenForm({ token: tokens.refresh_token || tokens.access_token, client_id: clientId });
  const headers = new Headers(oauthClientHeaders());
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  fetch(`${apiBase}/oauth/revoke`, { method: 'POST', headers, body: form })
    .catch(() => undefined)
    .finally(finish);
});
app.get('/logout', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ログアウト</title><body style="font-family:sans-serif;max-width:520px;margin:12vh auto;padding:24px;color:#0f172a"><h1>ログアウトしますか？</h1><p>このアプリのセッションを終了します。</p><form method="post" action="/logout"><button style="padding:12px 18px;background:#4f46e5;color:white;border:0;border-radius:8px">ログアウト</button> <a href="/" style="margin-left:12px">キャンセル</a></form></body></html>`);
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
}

const distPath = path.join(rootDir, 'dist');
app.use(express.static(distPath, { index: false, maxAge: isProduction ? '1h' : 0 }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'), err => { if (err) next(err); });
});
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Sennin Portal listening on ${port}`);
  console.log(`Configured redirect URI: ${redirectUri}`);
});
