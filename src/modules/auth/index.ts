import jwt from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";
import { AuthService } from "./service";
import { AuthModel } from "./model";
import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { bearer } from "@elysiajs/bearer";
import { access } from "fs/promises";

export const auth = new Elysia()
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET as string,
      exp: "30m",
    }),
  )
  .use(bearer())
  .decorate("service", new AuthService())
  .use(AuthModel)
  .post(
    "/register",
    async ({
      jwt,
      status,
      body: { email, password, full_name },
      service,
      set,
      cookie: { refreshToken },
    }) => {
      const result = await service.createUser(
        email,
        password,
        full_name as string,
      );

      const jwtRefreshToken = await jwt.sign({ sub: result.id, exp: "14d" });
      const accessToken = await jwt.sign({ sub: result.id });

      refreshToken.set({
        value: jwtRefreshToken,
        httpOnly: true,
      });

      return status(201, { ...result, accessToken });
    },
    {
      response: {
        201: "registerResponse",
        409: t.String(),
        500: t.String(),
      },
      body: "registerBody",
      error({ error }) {
        if (error instanceof DrizzleQueryError) {
          if (error.cause instanceof postgres.PostgresError) {
            if (error.cause.constraint_name == "users_email_unique") {
              return status(409, "User with this email already exists");
            }
          }
        }

        return status(500, "Internal Server Error");
      },
    },
  )
  .post(
    "/login",
    async ({
      jwt,
      body: { email, password },
      service,
      set,
      headers,
      cookie: { refreshToken },
    }) => {
      const data = await service.loginUser(email, password);

      const refresh_token = await jwt.sign({ sub: data.id, exp: "14d" });

      await service.storeRefreshToken(
        data.id,
        headers["user-agent"] as string,
        refresh_token,
      );

      const accessToken = await jwt.sign({ sub: data.id });

      refreshToken.set({
        value: refresh_token,
        httpOnly: true,
      });

      return { ...data, accessToken };
    },
    {
      body: "loginBody",
      response: {
        200: "registerResponse",
        401: t.String({ default: "Wrong password" }),
        404: t.String({ default: "Not found" }),
      },
    },
  )
  .get(
    "/refresh",
    async ({
      jwt,
      service,
      headers,
      set,
      bearer,
      cookie: { refreshToken },
    }) => {
      const res = await jwt
        .verify(refreshToken.value as string)
        .then((decoded) => {
          if (decoded === false) {
            throw status(401, "Unauthorized");
          }

          return decoded.sub;
        });

      if (res) {
        const access_token = await jwt.sign({ sub: res as string });

        set.headers["authorization"] = `Bearer ${access_token}`;

        return {
          accessToken: access_token,
        };
      }

      return status(500, "Internal Server Error");
    },
    {
      response: {
        200: t.Object({
          accessToken: t.String(),
        }),
        401: t.String(),
        500: t.String(),
      },
    },
  );
