import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),version:integer('version').notNull(),payload:text('payload').notNull(),write_token:text('write_token').notNull()});
export const records=sqliteTable('records',{owner:text('owner').notNull(),kind:text('kind').notNull(),id:text('id').notNull(),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.owner,t.kind,t.id]})]);
export const quotas=sqliteTable('quotas',{name:text('name').primaryKey(),count:integer('count').notNull()});
