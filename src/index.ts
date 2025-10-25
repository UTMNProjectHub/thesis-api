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

import jwt from "@elysiajs/jwt";
import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { auth } from "./modules/auth";
import { user } from "./modules/user";
import "./rpc";
import { profile } from "./modules/profile";
import cors from "@elysiajs/cors";
import { subject } from "./modules/subject";
import { theme } from "./modules/themes";
import { file } from "./modules/file";

const app = new Elysia({
  prefix: "/api",
  precompile: true,
  aot: process.env.NODE_ENV === "production",
  serve: {
    maxRequestBodySize: 1024 * 1024 * 10, // 10MB
  },
});

app.use(openapi());

app.use(
  cors({
    origin:
      process.env.NODE_ENV == "production"
        ? /^https?:\/\/([a-z0-9-]+\.)*quizy\.saveitsky\.ru(?::\d+)?$/i
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

app.onError(({ error, code }) => {
  console.error(`[${code}]`, error);

  if (code === "NOT_FOUND") {
    return {
      error: "Route not found",
      statusCode: 404,
    };
  }

  if (code === "VALIDATION") {
    return {
      error: "Validation failed",
      statusCode: 422,
      details: error.message,
    };
  }

  if (code === "INTERNAL_SERVER_ERROR") {
    return {
      error: "Internal server error",
      statusCode: 500,
    };
  }

  return {
    error: error instanceof Error ? error.message : "Unknown error",
    statusCode: 500,
  };
});

if (process.env.NODE_ENV !== "production") {
  app.onRequest(({ request }) => {
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url}`,
    );
  });
}

app.listen({
  port: parseInt(process.env.ELYSIA_PORT as string),
  hostname: "0.0.0.0",
  reusePort: true,
});

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
console.log(
  `🔧 Precompilation: ${process.env.NODE_ENV === "production" ? "enabled" : "disabled"}`,
);

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await app.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await app.stop();
  process.exit(0);
});
