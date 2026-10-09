
const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

app.get("/api/status", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      message: "DATABASE_URL no está configurada en Render"
    });
  }

  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      project: "Dedsafio Extremo",
      database: "connected"
    });
  } catch (error) {
    console.error("Error de conexión con Neon:", error.message);

    res.status(503).json({
      ok: false,
      message: "No se pudo conectar con la base de datos"
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api", (req, res) => {
  res.json({
    project: "Dedsafio Extremo",
    version: "1.0.0"
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada"
  });
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
    
