// db/init_db.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const dbFile = "./db/database.sqlite";

async function initDB() {
  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  // 外部キー制約を有効化
  await db.exec(`PRAGMA foreign_keys = ON;`);

  // users テーブル
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
  `);

  // tasks テーブル
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      completed INTEGER DEFAULT 0,
      comments TEXT
    );
  `);

  // templates テーブル
  await db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT
    );
  `);

  // template_tasks テーブル
  await db.exec(`
    CREATE TABLE IF NOT EXISTS template_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      title TEXT,
      description TEXT,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );
  `);

  // デモ用ユーザー
  await db.run(`
    INSERT OR IGNORE INTO users (username, password)
    VALUES ('admin', 'password');
  `);

  console.log("✅ SQLiteデータベースを初期化しました");
  await db.close();
}

// 実行
initDB();
