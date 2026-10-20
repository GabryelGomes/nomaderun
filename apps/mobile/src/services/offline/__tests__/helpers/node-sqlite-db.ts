/* eslint-disable @typescript-eslint/no-require-imports */
import type { SqlDb, SqlValue } from '../../sqlite-store';

/**
 * Adaptador de teste: o mesmo SQL do expo-sqlite rodando no SQLite embutido do Node 22
 * (`node:sqlite`). Use em suítes com `@jest-environment node`.
 */
export function openNodeSqlite(path = ':memory:'): SqlDb & { close: () => void } {
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => NodeDb };
  const db = new DatabaseSync(path);
  return {
    execAsync: async (sql) => void db.exec(sql),
    runAsync: async (sql, params) => db.prepare(sql).run(...params),
    getAllAsync: async <T,>(sql: string, params: SqlValue[]) => db.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T,>(sql: string, params: SqlValue[]) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    withTransactionAsync: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}

type NodeStmt = { run: (...p: SqlValue[]) => unknown; all: (...p: SqlValue[]) => unknown[]; get: (...p: SqlValue[]) => unknown };
type NodeDb = { exec: (sql: string) => void; prepare: (sql: string) => NodeStmt; close: () => void };
