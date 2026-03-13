import mysql from 'mysql2/promise';
import { config } from './config.js';
import type { DbPropertyRow } from './types.js';

let pool: mysql.Pool | null = null;

export function createPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function fetchProperties(
  db: mysql.Pool,
  opts: { from: string; to: string }
): Promise<DbPropertyRow[]> {
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`
    SELECT *
    FROM property_clone
    WHERE
      ClosePrice > 25000
      AND CloseDateTimestamp >= ?
      AND CloseDateTimestamp <= ?
      AND OverallQuality > 0
    ORDER BY CloseDateTimestamp DESC
  `, [opts.from, opts.to]);

  return rows as DbPropertyRow[];
}

export async function fetchLegacyProperties(
  db: mysql.Pool,
  listingIds: string[]
): Promise<Map<string, DbPropertyRow>> {
  if (listingIds.length === 0) return new Map();

  // Batch into chunks of 1000 to avoid MySQL parameter limits
  const map = new Map<string, DbPropertyRow>();
  const chunkSize = 1000;

  for (let i = 0; i < listingIds.length; i += chunkSize) {
    const chunk = listingIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM property WHERE ListingId IN (${placeholders})`,
      chunk
    );
    for (const row of rows as DbPropertyRow[]) {
      map.set(row.ListingId, row);
    }
  }

  return map;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
