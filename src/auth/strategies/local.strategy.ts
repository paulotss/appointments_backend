import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'usernameLogin',
      passwordField: 'password',
    });
  }

  async validate(usernameLogin: string, password: string) {
    return this.authService.validateUser(usernameLogin, password);
  }
}
