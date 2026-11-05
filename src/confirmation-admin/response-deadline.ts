import { BadRequestException } from '@nestjs/common';

export function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const canonical = value.length === 20 ? value.slice(0, -1) + '.000Z' : value;
  return new Date(value).toISOString() === canonical;
}

export function assertResponseDeadline(
  campaign: {
    responseDeadlineAt?: Date | null;
    campaignDate: Date;
    items: Array<{ recipientState: string; appointmentTime?: string | null }>;
  },
  now: Date,
) {
  const deadline = campaign.responseDeadlineAt;
  const times = campaign.items
    .filter((item) => item.recipientState === 'ELIGIBLE')
    .map((item) => item.appointmentTime);
  if (
    !deadline ||
    !Number.isFinite(deadline.getTime()) ||
    deadline <= now ||
    !times.length ||
    times.some(
      (time) => !time || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time),
    )
  )
    throw new BadRequestException(
      'Defina um prazo futuro e horários elegíveis válidos antes de aprovar.',
    );
  const first = [...times].sort()[0]!;
  // Current campaign dates use São Paulo (UTC-03); round-trip also verifies the local date/time.
  const appointment = new Date(
    `${campaign.campaignDate.toISOString().slice(0, 10)}T${first.length === 5 ? first + ':00' : first}-03:00`,
  );
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(appointment);
  if (
    local !==
      `${campaign.campaignDate.toISOString().slice(0, 10)} ${first.length === 5 ? first + ':00' : first}` ||
    deadline >= appointment
  )
    throw new BadRequestException(
      'O prazo deve anteceder o primeiro horário elegível em America/Sao_Paulo.',
    );
}
