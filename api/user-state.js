import { ensureSchema, hasDatabase, query } from "./_lib/db.js";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function ensureUser(userId) {
  await query(
    `insert into users (id, updated_at)
     values ($1, now())
     on conflict (id)
     do update set updated_at = now()`,
    [userId],
  );
}

export default async function handler(req, res) {
  if (!hasDatabase()) {
    res.status(503).json({ error: "DATABASE_URL tanımlı değil" });
    return;
  }

  await ensureSchema();

  if (req.method === "GET") {
    const userId = req.query?.userId;
    if (!userId) {
      res.status(400).json({ error: "userId gerekli" });
      return;
    }

    await ensureUser(userId);
    const result = await query(
      `select state, updated_at from user_states where user_id = $1`,
      [userId],
    );
    const row = result.rows[0] || null;
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      userId,
      state: row?.state || null,
      updatedAt: row?.updated_at || null,
    });
    return;
  }

  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    const userId = body?.userId;
    const state = body?.state;
    if (!userId || !state || typeof state !== "object") {
      res.status(400).json({ error: "userId ve state gerekli" });
      return;
    }

    await ensureUser(userId);
    const result = await query(
      `insert into user_states (user_id, state, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id)
       do update set state = excluded.state, updated_at = now()
       returning updated_at`,
      [userId, JSON.stringify(state)],
    );

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, userId, updatedAt: result.rows[0]?.updated_at || null });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
