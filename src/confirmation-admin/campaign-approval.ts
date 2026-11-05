import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const approvalInclude = {
  items: true,
  events: { orderBy: { id: 'asc' as const } },
};
export type ApprovalCampaign = Prisma.ConfirmationCampaignGetPayload<{
  include: typeof approvalInclude;
}>;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export function campaignRevision(campaign: ApprovalCampaign): string {
  return hash(
    JSON.stringify({
      id: campaign.id,
      date: campaign.campaignDate,
      source: campaign.source,
      status: campaign.status,
      ...(campaign.responseDeadlineAt
        ? { responseDeadlineAt: campaign.responseDeadlineAt }
        : {}),
      approvedAt: campaign.approvedAt,
      approvedBy: campaign.approvedByUserId,
      consultation: campaign.consultationState,
      // Lifecycle event IDs distinguish reopening/reapproval even under an identical clock.
      events: campaign.events.map((event) => [event.id, event.action]),
      items: [...campaign.items]
        .sort((a, b) => a.id - b.id)
        .map((item) => [
          item.id,
          item.appointmentRef,
          item.patientRef,
          item.recipientRef,
          item.informedPhoneRef,
          item.professionalRef,
          item.appointmentTime,
          item.agendaRef,
          item.sourceResolution,
          item.isMinor,
          item.recipientState,
          item.reasonCode,
        ]),
    }),
  );
}
