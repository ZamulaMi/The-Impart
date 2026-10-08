import { neon } from '@neondatabase/serverless';

// Очищення рядка підключення: автоматично витягує чистий postgresql://...
export function cleanConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  const str = raw.trim();

  const match = str.match(/postgres(?:ql)?:\/\/[^\s"'`]+/i);
  if (match) {
    let extracted = match[0].trim();
    extracted = extracted.replace(/[;"'`\\]+$/, '').trim();
    return extracted;
  }

  return undefined;
}

// Отримання клієнта Neon (виключно зі змінних середовища)
export function getNeonSql(): any | null {
  const candidateKeys = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_NO_SSL',
  ] as const;

  let connectionString: string | undefined;

  for (const k of candidateKeys) {
    const val = cleanConnectionString(process.env[k]);
    if (val) {
      connectionString = val;
      break;
    }
  }

  // Якщо рядок передано через окремі змінні PGHOST / PGUSER
  if (!connectionString && process.env.PGUSER && process.env.PGHOST && process.env.PGDATABASE) {
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD || '';
    const host = process.env.PGHOST;
    const db = process.env.PGDATABASE;
    connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
  }

  if (!connectionString) {
    return null;
  }

  try {
    return neon(connectionString);
  } catch (err) {
    console.warn('Neon client initialization error:', err);
    return null;
  }
}

