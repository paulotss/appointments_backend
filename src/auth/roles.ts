import { UserRole } from '@prisma/client';

export const ALL_USER_ROLES = [
  UserRole.PATIENT,
  UserRole.PROFESSIONAL,
  UserRole.RECEPTIONIST,
  UserRole.ADMIN,
] as const;

export const STAFF_ROLES = [UserRole.RECEPTIONIST, UserRole.ADMIN] as const;

export const CLINICAL_STAFF_ROLES = [
  UserRole.PROFESSIONAL,
  UserRole.RECEPTIONIST,
  UserRole.ADMIN,
] as const;

export const AGENDA_ROLES = [
  UserRole.PATIENT,
  UserRole.PROFESSIONAL,
  UserRole.RECEPTIONIST,
  UserRole.ADMIN,
] as const;
