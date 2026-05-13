import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const passwordHash = await bcrypt.hash(createUserDto.passwordHash, 10);
      return await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          passwordHash,
          usernameLogin: createUserDto.usernameLogin,
          isAdmin: createUserDto.isAdmin ?? false,
          extension: createUserDto.extension,
        },
        omit: { passwordHash: true },
      });
    } catch (error) {
      this.handleKnownErrors(error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      omit: { passwordHash: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    try {
      const data: Prisma.UserUncheckedUpdateInput = { ...updateUserDto };

      if (updateUserDto.passwordHash) {
        data.passwordHash = await bcrypt.hash(updateUserDto.passwordHash, 10);
      }

      return await this.prisma.user.update({
        where: { id },
        data,
        omit: { passwordHash: true },
      });
    } catch (error) {
      this.handleKnownErrors(error);
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where: { id },
      omit: { passwordHash: true },
    });
  }

  async validateUserCredentials(usernameLogin: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { usernameLogin },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      name: user.name,
      usernameLogin: user.usernameLogin,
      isAdmin: user.isAdmin,
    };
  }

  private handleKnownErrors(error: unknown): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : target != null ? [target] : [];
      if (fields.includes('extension')) {
        throw new BadRequestException('extension already in use');
      }
      throw new BadRequestException('usernameLogin already exists');
    }
  }
}
