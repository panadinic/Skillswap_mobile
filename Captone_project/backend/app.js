const express = require("express");
const cors = require("cors");
const { randomUUID } = require("crypto");
require("dotenv").config();
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
// Habilita CORS controlado por entorno (en dev, refleja origen; en prod, set CORS_ORIGIN)
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
};
app.use(cors(corsOptions));
// Parsea los cuerpos de las peticiones entrantes con formato JSON
app.use(express.json());

app.use((req, res, next) => {
  const requestId = randomUUID();
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      requestId,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      user: req.user?.uid || null,
    });
  });
  res.on("error", (error) => {
    logger.error("Response error", {
      requestId,
      message: error.message,
    });
  });
  req.requestId = requestId;
  next();
});

// --- Carga de Rutas ---
// Se importa los módulos que definen los endpoints de la API.
const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const publicationsRoutes = require('./routes/publicationsRoutes');
const interactionsRoutes = require('./routes/interactionsRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const reviewsRoutes = require('./routes/reviewsRoutes');
const conversationsRoutes = require('./routes/conversationsRoutes');

// --- Registro de Endpoints ---
// Asocia cada módulo de rutas con su prefijo de URL base.
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/publications", publicationsRoutes);
app.use("/api/interactions", interactionsRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/conversations", conversationsRoutes);

// --- Ruta de Verificación de Salud ---
// Un endpoint simple para confirmar que el servidor está en línea.
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// --- Inicio del Servidor ---
// Pone al servidor a escuchar peticiones en el puerto especificado.
app.listen(PORT, () => {
  logger.info(`Backend corriendo en http://localhost:${PORT}`);
});

