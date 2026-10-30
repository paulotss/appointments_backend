import 'dotenv/config';
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import {
  plannedGuideDocumentNames,
  renameGuideDocumentFiles,
} from './guide-document-name';

const apply = process.argv.includes('--apply');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const bucket = process.env.R2_BUCKET;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }
  if (!bucket || !process.env.R2_ENDPOINT) {
    throw new Error('R2_BUCKET and R2_ENDPOINT are required');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const storage = new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY ?? '',
      secretAccessKey: process.env.R2_SECRET_KEY ?? '',
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const guides = await prisma.insuranceGuide.findMany({
    where: { documents: { some: {} } },
    select: {
      id: true,
      guideNumber: true,
      documents: {
        select: { id: true, originalName: true, mimeType: true, storageKey: true },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  let renamed = 0;
  let missing = 0;
  for (const guide of guides) {
    const planned = plannedGuideDocumentNames(
      guide.documents,
      guide.guideNumber,
      guide.id,
    );
    const changes = planned.filter(
      (document) =>
        document.originalName !== document.fileName ||
        document.storageKey !== document.storageKeyTarget,
    );
    if (changes.length === 0) {
      continue;
    }
    const label = guide.guideNumber?.trim() || `#${guide.id}`;
    for (const document of changes) {
      console.log(
        `${label}: ${document.originalName} -> ${document.fileName}`,
      );
    }
    if (!apply) {
      renamed += changes.length;
      continue;
    }
    renamed += await renameGuideDocumentFiles({
      guideId: guide.id,
      guideNumber: guide.guideNumber,
      documents: guide.documents,
      copy: async (sourceKey, destinationKey) => {
        if (sourceKey === destinationKey) return;
        await storage.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: destinationKey,
            CopySource: encodeURI(`${bucket}/${sourceKey}`),
          }),
        );
      },
      remove: async (storageKey) => {
        await storage.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
        ).catch(() => undefined);
      },
      update: (id, data) =>
        prisma.insuranceGuideDocument
          .update({ where: { id }, data })
          .then(() => undefined),
      onMissing: (document) => {
        missing += 1;
        console.error(
          `Arquivo ausente no armazenamento, guia ${label}: ${document.storageKey}`,
        );
      },
    });
  }

  console.log(
    apply
      ? `Renomeados ${renamed} arquivo(s) em ${guides.length} guia(s) com documento. Ausentes no armazenamento: ${missing}.`
      : `Simulação: ${renamed} arquivo(s) seriam renomeados em ${guides.length} guia(s) com documento. Use --apply para gravar.`,
  );
  await prisma.$disconnect();
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
