import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  private readonly revokedTokens = new Map<string, number>();

  revoke(jti: string, exp: number) {
    this.cleanupExpired();
    this.revokedTokens.set(jti, exp);
  }

  isRevoked(jti: string): boolean {
    this.cleanupExpired();
    return this.revokedTokens.has(jti);
  }

  private cleanupExpired() {
    const now = Math.floor(Date.now() / 1000);

    for (const [jti, exp] of this.revokedTokens.entries()) {
      if (exp <= now) {
        this.revokedTokens.delete(jti);
      }
    }
  }
}
