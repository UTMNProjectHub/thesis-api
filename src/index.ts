if (!process.env.JWT_SECRET) {
  throw new Error("Please set JWT_SECRET in dotenv");
}

if (!process.env.ELYSIA_PORT) {
  throw new Error("Please set ELYSIA_PORT in dotenv");
}

if (!process.env.RPC_PORT) {
  throw new Error("Please set RPC_PORT in dotenv");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Please set DATABASE_URL in dotenv");
}

if (!process.env.REDIS_URL) {
  throw new Error("Please set REDIS_URL in dotenv");
}

if (!process.env.AMQP_URL) {
  throw new Error("Please set AMQP_URL in dotenv");
}

if (!process.env.WS_PORT) {
  throw new Error("Please set WS_PORT in dotenv");
}

import jwt from "@elysiajs/jwt";
import openapi from "@elysiajs/openapi";
import { Elysia, status } from "elysia";
import { auth } from "./modules/auth";
import { user } from "./modules/user";
import "./rpc";
import { profile } from "./modules/profile";
import cors from "@elysiajs/cors";
import { subject } from "./modules/subject";
import { theme } from "./modules/themes";
import { file } from "./modules/file";
import { quiz } from "./modules/quiz";
import { question } from "./modules/question";
import { generation } from "./modules/generation";
import { initializeAMQP } from "./amqp";
import { websocket } from "./modules/websocket";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import staticPlugin from "@elysiajs/static";
import { quizSession } from "./modules/session";

// HTTP API app
const app = new Elysia({
  prefix: "/api",
  precompile: true,
  aot: process.env.NODE_ENV === "production",
  serve: {
    maxRequestBodySize: 1024 * 1024 * 10, // 10MB
  },
});

// WebSocket app (separate server)
const wsApp = new Elysia();

app.use(staticPlugin());

app.use(
  openapi(),
);

app.use(
  cors({
    origin:
      process.env.NODE_ENV == "production"
        ? RegExp('^https:\/\/.*\.saveitsky\.ru$')
        : true,
    credentials: true,
  }),
);

app.get("/health", () => ({
  status: "ok",
  timestamp: Date.now(),
  uptime: process.uptime(),
}));

app.use(auth);
app.use(user);
app.use(profile);
app.use(subject);
app.use(theme);
app.use(file);
app.use(quiz);
app.use(question);
app.use(generation)
app.use(quizSession);

// WebSocket server setup
wsApp.use(websocket);

app.onError(({ error, code }) => {
  console.error(`[${code}]`, error);

  return error;
});

if (process.env.NODE_ENV !== "production") {
  app.onRequest(({ request }) => {
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url}`,
    );
  });
}

// Initialize AMQP bridge before starting servers
initializeAMQP()
  .then(() => {
    // Start HTTP API server
    app.listen({
      port: parseInt(process.env.ELYSIA_PORT as string),
      hostname: "0.0.0.0",
      reusePort: true,
    });

    // Start WebSocket server on separate port
    wsApp.listen({
      port: parseInt(process.env.WS_PORT as string),
      hostname: "0.0.0.0",
      reusePort: true,
    });

    console.log(
      `🦊 HTTP API running at ${app.server?.hostname}:${app.server?.port}`,
    );
    console.log(
      `🔌 WebSocket running at ${wsApp.server?.hostname}:${wsApp.server?.port}`,
    );
    console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(
      `🔧 Precompilation: ${process.env.NODE_ENV === "production" ? "enabled" : "disabled"}`,
    );
  })
  .catch((error) => {
    console.error("Failed to initialize AMQP:", error);
    process.exit(1);
  });

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await Promise.all([app.stop(), wsApp.stop()]);
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await Promise.all([app.stop(), wsApp.stop()]);
  process.exit(0);
});