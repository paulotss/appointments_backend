export interface JwtPayload {
  sub: number;
  usernameLogin: string;
  isAdmin: boolean;
  jti: string;
  exp?: number;
}
