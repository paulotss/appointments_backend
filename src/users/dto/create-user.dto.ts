export class CreateUserDto {
  name!: string;
  passwordHash!: string;
  usernameLogin!: string;
  isAdmin?: boolean;
  extension?: number | null;
}
