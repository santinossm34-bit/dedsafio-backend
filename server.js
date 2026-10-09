
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

app.get("/api/status", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        message: "Falta configurar DATABASE_URL en Render"
      });
    }

    await pool.query("SELECT 1");

    res.json({
      ok: true,
      project: "Dedsafio Extremo",
      database: "connected"
    });
  } catch (error) {
    console.error("Error de base de datos:", error.message);
    res.status(503).json({
      ok: false,
      message: "No se pudo conectar con la base de datos"
    });
  }
});

app.get("/", (req, res) => {
  res.type("html").send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Dedsafio Extremo</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #080b12;
          color: #f4f5f7;
          font-family: Arial, sans-serif;
        }
        main {
          width: min(440px, 90%);
          padding: 32px;
          border: 1px solid #292f3d;
          border-radius: 18px;
          background: #111722;
        }
        .tag { color: #eab84a; font-size: 12px; letter-spacing: 2px; }
        h1 { font-size: 30px; margin-bottom: 8px; }
        p { color: #aab3c3; line-height: 1.6; }
        a {
          display: block;
          margin-top: 24px;
          padding: 14px;
          border-radius: 9px;
          text-align: center;
          background: #eab84a;
          color: #17130a;
          text-decoration: none;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <main>
        <div class="tag">MINECRAFT • JAVA 1.20.1</div>
        <h1>Dedsafio Extremo</h1>
        <p>Tu cuenta de Minecraft y Discord, vinculadas en un solo lugar.</p>
        <p>Estamos preparando el sistema de registro y verificación.</p>
        <a href="/api/status">Comprobar conexión</a>
      </main>
    </body>
    </html>
  `);
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Dedsafio Extremo iniciado en el puerto ${port}`);
});
