export class UpdateUserDto {
  name?: string;
  passwordHash?: string;
  usernameLogin?: string;
  isAdmin?: boolean;
  extension?: number | null;
}
