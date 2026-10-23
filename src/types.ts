export type AccountUser = {
  sub?: string;
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  picture?: string;
  avatar_url?: string;
  [key: string]: unknown;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: AccountUser;
};