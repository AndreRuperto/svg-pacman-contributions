import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Configuração da conexão com PostgreSQL
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/pacman_ranking';

// Cliente postgres.js
export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Instância do Drizzle ORM
export const db = drizzle(sql, { schema });

/**
 * Fecha a conexão com o banco de dados
 */
export async function closeConnection() {
  await sql.end();
}
