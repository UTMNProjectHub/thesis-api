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
import "./rpc";

const app = new Elysia({ prefix: "/api", precompile: true });

app.use(openapi());
app.use(auth);
app.listen(parseInt(process.env.ELYSIA_PORT as string));

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
