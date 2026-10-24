# Sennin Portal — React + TypeScript + Node.js

既存のSennin Portal画面をReact/TypeScriptに移し、Node.js/Express側でSennin Account OAuth 2.0 Authorization Code + PKCE (S256) を処理する構成です。RenderとRailway向け設定を含みます。

## 構成

- `src/components/`: 画面を役割ごとのReactコンポーネントに分割
  - `layout/`: Sidebar、Topbar、Footer
  - `dashboard/`: SignedOut、PageHeading、WelcomeCard、PointsCard、ServiceGrid
  - `account/`: AccountModal
  - `common/`: ErrorNotice
- `src/hooks/usePortalData.ts`: セッション・ポイント情報の取得と読み込み状態
- `src/lib/`: API通信とアカウント表示名などの共通処理
- `src/`: React + TypeScript + Viteのフロントエンド
- `server/index.ts`: Express API、OAuth開始/Callback、トークン保管、UserInfo、ポイントAPI、ログアウト
- `.env.example`: 環境変数のテンプレート
- `render.yaml`: Render設定
- `railway.json`: Railway設定

## ローカル起動

Node.js 20以上を推奨します。

```bash
npm install
cp .env.example .env
```

`.env` を編集し、Sennin Accountの開発者設定に登録した実際の値を設定します。Windows PowerShellでは `Copy-Item .env.example .env` でも作成できます。

```bash
npm run dev
```

フロントエンドは `http://localhost:5173`、Node APIは `http://localhost:3000` です。OAuthの `OAUTH_REDIRECT_URI` は開発中もCallback先のNodeサーバーに向けてください。開発者設定のredirect URIにも完全一致で登録する必要があります。

本番ビルドと起動:

```bash
npm run build
npm start
```

## 必須環境変数

- `APP_ORIGIN`: 公開サイトのオリジン。末尾にパスを付けない（例 `https://your-app.onrender.com`）
- `OAUTH_AUTHORIZE_URL`: Sennin Accountの正式な認可エンドポイント。仕様書ではGASのユーザー画面URLが記載されていますが、GASがOAuthパラメーターを受け取って認可処理へ転送するかは本番確認が必要です。
- `OAUTH_CLIENT_ID`: 開発者設定で発行されたClient ID
- `OAUTH_CLIENT_SECRET`: 機密クライアントの場合にサーバー環境変数へ設定。公開しない
- `OAUTH_REDIRECT_URI`: `https://your-app.onrender.com/auth/callback` のようなCallback URL
- `SESSION_SECRET`: 32文字以上のランダムな秘密値
- `OAUTH_SCOPES`: 必要最小限のスコープ。例 `profile email points:read`

`OAUTH_TOKEN_URL`, `OAUTH_USERINFO_URL`, `OAUTH_POINTS_URL` は既定値を用意していますが、実サーバーのOAuthメタデータや応答を確認したうえで必要なら変更してください。

## Sennin Account側で必要な設定

1. アプリを登録し、Client IDを取得する。
2. 本番のCallback URLをredirect URIとして完全一致で登録する。
3. 使用するスコープをアプリに許可する。
4. クライアント認証方式が `client_secret_basic` / `client_secret_post` のどちらか確認する。
5. 認可画面の正式なURLと、GAS URLが認可パラメーターを処理するかを確認する。
6. 公開サーバーでUserInfoとポイントAPIの実際のJSON形式を確認する。

このプロジェクトは、仕様書に記載されたOAuthエンドポイントを利用する実装です。Sennin Account本番サーバーへの実接続・認証成功は、登録済みClient ID/Secret、Callback登録、認可URLの実装に依存するため、資格情報なしでは保証できません。

## Renderへのデプロイ

1. GitHubへプロジェクトをpushする。
2. RenderでBlueprintまたはWeb Serviceとしてリポジトリを接続する。
3. `render.yaml` を使うか、Build Commandを `npm install && npm run build`、Start Commandを `npm start` にする。
4. RenderのEnvironmentに `APP_ORIGIN`, `OAUTH_AUTHORIZE_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REDIRECT_URI` を設定する。
5. `APP_ORIGIN` をRenderのHTTPS URLに、`OAUTH_REDIRECT_URI` を `https://<host>/auth/callback` に設定する。
6. 同じCallback URLをSennin Account開発者設定にも登録する。

## Railwayへのデプロイ

1. GitHubリポジトリをRailwayへ接続する。
2. `railway.json` によりBuild/Start/Health checkを設定する。
3. VariablesにRenderと同じ環境変数を設定する。`APP_ORIGIN` はRailwayの公開HTTPSドメイン、`OAUTH_REDIRECT_URI` はそのドメインの `/auth/callback` にする。
4. Railwayの公開ドメインを生成し、そのURLをSennin Account側のredirect URIにも登録する。

RenderとRailwayの両方で同じ環境変数名を使えますが、デプロイ先ごとに正しい公開URLを設定してください。

## セキュリティ・運用上の注意

- `.env` はGitへコミットしないでください。
- Client Secretとトークンはフロントエンドへ送信しません。
- `state` とPKCE S256を検証します。
- CookieはHttpOnly、SameSite=Lax。本番はSecure属性を有効にします。
- セッションは標準のMemoryStoreです。単一インスタンスの試験用途向けで、再起動でセッションが失われ、複数インスタンス構成に向きません。長期運用ではRedis等の永続セッションストアへ切り替えてください。`.env.example` に `REDIS_URL` の項目を用意していますが、Redis接続はまだ有効化していません。
- ログアウトは失効APIを呼び出してからローカルセッションを破棄します。実際の失効API仕様に差がある場合は、サーバー応答を確認して調整してください。
- ポイントレスポンスのJSONフィールドは仕様書で確定していないため、フロントは `points`, `balance`, `total` のみを表示候補にしています。実レスポンスに合わせて変更してください。
- このプロジェクトはポイントを読み取るだけです。ポイント変更APIは権限と管理者制限が未確認のため実装していません。

## Feature setup: YouTube, Supabase chat, and game portal

### YouTube
Set `YOUTUBE_DATA_API_KEY` to a YouTube Data API v3 key. The backend `/api/youtube/search` endpoint uses the official API first and falls back to the comma-separated `YOUTUBE_INVIDIOUS_INSTANCES` list when the key is missing or the official request fails.

### Supabase chat
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before building the frontend, and set `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` only on the server. In Supabase SQL Editor, run `supabase-schema.sql`. The browser can read and subscribe to realtime updates; message inserts go through Express and use the authenticated Sennin Account session to assign the user ID. Never expose the service role key in frontend variables.

### Game portal
The Game page embeds `https://cdn.jsdelivr.net/gh/CloudMoonApp/web@main/portal-260605.html` in a full-size iframe. The floating bottom-right control can be dragged and toggles the Portal sidebar/header/footer for immersive play. The game document is hosted by a third party; availability and its own security/privacy behavior are outside this project's control.

### OAuth response compatibility
The server normalizes common UserInfo wrappers (`user`, `profile`) and user identifiers (`id`, `user_id`, `sub`, `uid`), and normalizes common points field names. The live OAuth integration still requires the deployed Sennin Account's actual endpoint URLs, registered Client ID, redirect URI, and token endpoint authentication method to match the environment variables. Do not consider OAuth production-verified until a real login and points request succeed against that deployment.
