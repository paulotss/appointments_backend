import { ContactMethod } from '@prisma/client';

export class CreateAppointmentDto {
  date!: string;
  clientName!: string;
  phone?: string;
  contactMethod!: ContactMethod;
  firstTime!: boolean;
  scheduled!: boolean;
  reason?: string;
  specialtyId?: number | null;
  notes?: string;
  attendantId?: number | null;
}
