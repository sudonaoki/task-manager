// server.js
import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

// -----------------------------------------
// 基本設定
// -----------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Render環境では PORT が自動で割り当てられる
const PORT = process.env.PORT || 3000;

// SQLite接続
const dbPromise = open({
  filename: "./db/database.sqlite",
  driver: sqlite3.Database
});

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// -----------------------------------------
// ログイン
// -----------------------------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = await dbPromise;
  const user = await db.get(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password]
  );

  if (user) {
    res.json({ username: user.username });
  } else {
    res.status(401).json({ message: "ユーザー名またはパスワードが違います" });
  }
});

// -----------------------------------------
// タスク CRUD
// -----------------------------------------
app.get("/tasks", async (req, res) => {
  const db = await dbPromise;
  const tasks = await db.all("SELECT * FROM tasks ORDER BY id DESC");
  res.json(tasks);
});

// タスク詳細取得
app.get("/tasks/:id", async (req, res) => {
  const db = await dbPromise;
  const task = await db.get("SELECT * FROM tasks WHERE id = ?", [req.params.id]);

  if (!task) {
    return res.status(404).json({ message: "タスクが見つかりません" });
  }

  res.json(task);
});

app.post("/tasks", async (req, res) => {
  const { title, description } = req.body;
  const db = await dbPromise;
  const result = await db.run(
    "INSERT INTO tasks (title, description, completed) VALUES (?, ?, 0)",
    [title, description]
  );
  res.json({ id: result.lastID });
});

app.put("/tasks/:id", async (req, res) => {
  const { title, description, completed, comments } = req.body;
  const db = await dbPromise;
  await db.run(
    `UPDATE tasks SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       completed = COALESCE(?, completed),
       comments = COALESCE(?, comments)
     WHERE id = ?`,
    [
      title,
      description,
      completed !== undefined ? (completed ? 1 : 0) : undefined,
      comments,
      req.params.id
    ]
  );
  res.json({ message: "更新しました" });
});

app.delete("/tasks/:id", async (req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM tasks WHERE id = ?", [req.params.id]);
  res.json({ message: "削除しました" });
});

app.post("/tasks/reorder", (req, res) => {
  const { order } = req.body; // [{ id: 1, order: 0 }, ...]
  const stmt = db.prepare("UPDATE tasks SET `order` = ? WHERE id = ?");
  order.forEach(o => stmt.run(o.order, o.id));
  stmt.finalize();
  res.json({ success: true });
});


// -----------------------------------------
// テンプレート関連
// -----------------------------------------
app.get("/templates", async (req, res) => {
  const db = await dbPromise;
  const templates = await db.all("SELECT * FROM templates ORDER BY id DESC");
  res.json(templates);
});

app.get("/templates/:id", async (req, res) => {
  const db = await dbPromise;
  const template = await db.get(
    "SELECT * FROM templates WHERE id = ?",
    [req.params.id]
  );
  if (!template)
    return res.status(404).json({ message: "テンプレートが存在しません" });

  const tasks = await db.all(
    "SELECT id, title, description FROM template_tasks WHERE template_id = ?",
    [req.params.id]
  );
  res.json({ ...template, tasks });
});

app.post("/templates", async (req, res) => {
  const { label, tasks } = req.body;
  const db = await dbPromise;

  // 同名テンプレートがあれば上書き
  const existing = await db.get("SELECT * FROM templates WHERE label = ?", [
    label
  ]);
  let templateId;
  if (existing) {
    templateId = existing.id;
    await db.run("DELETE FROM template_tasks WHERE template_id = ?", [
      templateId
    ]);
    await db.run("UPDATE templates SET label = ? WHERE id = ?", [
      label,
      templateId
    ]);
  } else {
    const result = await db.run("INSERT INTO templates (label) VALUES (?)", [
      label
    ]);
    templateId = result.lastID;
  }

  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      await db.run(
        "INSERT INTO template_tasks (template_id, title, description) VALUES (?, ?, ?)",
        [templateId, t.title, t.description]
      );
    }
  }

  res.json({ id: templateId });
});

app.put("/templates/:id", async (req, res) => {
  const { tasks } = req.body;
  const db = await dbPromise;
  const template = await db.get(
    "SELECT * FROM templates WHERE id = ?",
    [req.params.id]
  );
  if (!template)
    return res.status(404).json({ message: "テンプレートが存在しません" });

  await db.run("DELETE FROM template_tasks WHERE template_id = ?", [
    req.params.id
  ]);
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      await db.run(
        "INSERT INTO template_tasks (template_id, title, description) VALUES (?, ?, ?)",
        [req.params.id, t.title, t.description]
      );
    }
  }
  res.json({ message: "テンプレートを保存しました" });
});

app.post("/templates/apply/:id", async (req, res) => {
  const db = await dbPromise;
  const tasks = await db.all(
    "SELECT title, description FROM template_tasks WHERE template_id = ?",
    [req.params.id]
  );
  for (const t of tasks) {
    await db.run(
      "INSERT INTO tasks (title, description, completed) VALUES (?, ?, 0)",
      [t.title, t.description]
    );
  }
  res.json({ message: "テンプレートを適用しました" });
});

// -----------------------------------------
// サーバー起動
// -----------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
