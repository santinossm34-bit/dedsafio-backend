
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  if (req.method === "OPTIONS") {
    if (origin !== allowedOrigin) {
      return res.status(403).end();
    }

    return res.status(204).end();
  }

  next();
});



app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      max: 5
    })
  : null;

const registrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera 15 minutos."
  }
});

app.get("/api/status", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      message: "Falta configurar DATABASE_URL en Render."
    });
  }

  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, project: "Dedsafio Extremo", database: "connected" });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({
      ok: false,
      message: "La base de datos no está disponible."
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/register", registrationLimit, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "El registro no está disponible."
    });
  }

  const minecraftUsername = String(req.body.minecraft || "").trim();
  const discordUsername = String(req.body.discord || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftUsername)) {
    return res.status(400).json({
      error: "El nombre de Minecraft no es válido."
    });
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return res.status(400).json({
      error: "Introduce un correo electrónico válido."
    });
  }

  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({
      error: "La contraseña debe tener entre 12 y 128 caracteres."
    });
  }

  if (discordUsername.length < 2 || discordUsername.length > 50) {
    return res.status(400).json({
      error: "Introduce tu usuario de Discord."
    });
  }

  try {
    // Consulta el UUID oficial de una cuenta Java con ese nombre.
    const response = await fetch(
      "https://api.minecraftservices.com/minecraft/profile/lookup/name/" +
      encodeURIComponent(minecraftUsername),
      { signal: AbortSignal.timeout(8000) }
    );

    if (response.status === 404) {
      return res.status(400).json({
        error: "No se encontró ese perfil de Minecraft Java."
      });
    }

    if (!response.ok) {
      return res.status(503).json({
        error: "No se pudo comprobar Minecraft. Inténtalo más tarde."
      });
    }

    const profile = await response.json();

    if (!profile.id || !profile.name) {
      return res.status(400).json({
        error: "El perfil de Minecraft no es válido."
      });
    }

    const minecraftUuid =
      profile.id.replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        "$1-$2-$3-$4-$5"
      );

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO players
        (minecraft_username, minecraft_uuid, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, minecraft_username, account_status, created_at`,
      [profile.name, minecraftUuid, email, passwordHash]
    );

    const player = result.rows[0];

    await pool.query(
      `INSERT INTO verification_logs (player_id, event_type, details)
       VALUES ($1, $2, $3)`,
      [
        player.id,
        "registration_created",
        JSON.stringify({ method: "website" })
      ]
    );

    return res.status(201).json({
      ok: true,
      message: "Cuenta creada. Aún falta completar las verificaciones.",
      player: {
        id: player.id,
        minecraft_username: player.minecraft_username,
        account_status: player.account_status,
        created_at: player.created_at
      }
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Ese correo o perfil de Minecraft ya está registrado."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      error: "No se pudo completar el registro."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

const port = process.env.PORT || 3000;

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Dedsafio Extremo iniciado en el puerto ${port}`);
});

async function shutdown() {
  server.close(async () => {
    if (pool) await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
