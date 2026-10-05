import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userRead = {
  omit: { passwordHash: true },
  include: {
    patient: { select: { id: true, name: true } },
    healthProfessional: { select: { id: true, name: true } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const role = createUserDto.role ?? UserRole.RECEPTIONIST;
    const links = this.resolveLinks(
      role,
      createUserDto.patientId ?? null,
      createUserDto.healthProfessionalId ?? null,
    );
    await this.ensureLinksExist(links);

    try {
      const passwordHash = await bcrypt.hash(createUserDto.passwordHash, 10);
      return await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          passwordHash,
          usernameLogin: createUserDto.usernameLogin,
          role,
          patientId: links.patientId,
          healthProfessionalId: links.healthProfessionalId,
          extension: createUserDto.extension,
          email: createUserDto.email,
        },
        ...userRead,
      });
    } catch (error) {
      this.handleKnownErrors(error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      ...userRead,
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      ...userRead,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const existing = await this.findOne(id);
    const role = updateUserDto.role ?? existing.role;
    const patientId = this.effectiveLink(
      role === UserRole.PATIENT,
      updateUserDto.patientId,
      existing.patientId,
    );
    const healthProfessionalId = this.effectiveLink(
      role === UserRole.PROFESSIONAL,
      updateUserDto.healthProfessionalId,
      existing.healthProfessionalId,
    );
    const links = this.resolveLinks(role, patientId, healthProfessionalId);
    await this.ensureLinksExist(links);

    try {
      const data: Prisma.UserUncheckedUpdateInput = {
        name: updateUserDto.name,
        usernameLogin: updateUserDto.usernameLogin,
        email: updateUserDto.email,
        extension: updateUserDto.extension,
        role,
        patientId: links.patientId,
        healthProfessionalId: links.healthProfessionalId,
      };

      if (updateUserDto.passwordHash) {
        data.passwordHash = await bcrypt.hash(updateUserDto.passwordHash, 10);
      }

      return await this.prisma.user.update({
        where: { id },
        data,
        ...userRead,
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
      ...userRead,
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
      role: user.role,
      patientId: user.patientId,
      healthProfessionalId: user.healthProfessionalId,
      extension: user.extension,
    };
  }

  private effectiveLink(
    roleKeepsLink: boolean,
    incoming: number | null | undefined,
    existing: number | null,
  ): number | null {
    if (incoming !== undefined) {
      return incoming;
    }
    return roleKeepsLink ? existing : null;
  }

  private resolveLinks(
    role: UserRole,
    patientId: number | null,
    healthProfessionalId: number | null,
  ): { patientId: number | null; healthProfessionalId: number | null } {
    if (role === UserRole.PATIENT) {
      if (healthProfessionalId != null) {
        throw new BadRequestException(
          'healthProfessionalId is only allowed for role PROFESSIONAL',
        );
      }
      if (patientId == null) {
        throw new BadRequestException('patientId is required for role PATIENT');
      }
      return { patientId, healthProfessionalId: null };
    }

    if (role === UserRole.PROFESSIONAL) {
      if (patientId != null) {
        throw new BadRequestException(
          'patientId is only allowed for role PATIENT',
        );
      }
      if (healthProfessionalId == null) {
        throw new BadRequestException(
          'healthProfessionalId is required for role PROFESSIONAL',
        );
      }
      return { patientId: null, healthProfessionalId };
    }

    if (patientId != null) {
      throw new BadRequestException(
        'patientId is only allowed for role PATIENT',
      );
    }
    if (healthProfessionalId != null) {
      throw new BadRequestException(
        'healthProfessionalId is only allowed for role PROFESSIONAL',
      );
    }
    return { patientId: null, healthProfessionalId: null };
  }

  private async ensureLinksExist(links: {
    patientId: number | null;
    healthProfessionalId: number | null;
  }) {
    if (links.patientId != null) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: links.patientId },
        select: { id: true },
      });
      if (!patient) {
        throw new BadRequestException('patient not found');
      }
    }

    if (links.healthProfessionalId != null) {
      const professional = await this.prisma.healthProfessional.findUnique({
        where: { id: links.healthProfessionalId },
        select: { id: true },
      });
      if (!professional) {
        throw new BadRequestException('health professional not found');
      }
    }
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
      if (fields.includes('email')) {
        throw new BadRequestException('email already in use');
      }
      if (fields.includes('patient_id')) {
        throw new BadRequestException('patient already linked to a user');
      }
      if (fields.includes('health_professional_id')) {
        throw new BadRequestException(
          'health professional already linked to a user',
        );
      }
      throw new BadRequestException('usernameLogin already exists');
    }
  }
}
