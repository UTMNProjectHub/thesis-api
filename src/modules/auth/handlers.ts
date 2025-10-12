import { Elysia } from "elysia";
import bearer from "@elysiajs/bearer";
import jwt from "@elysiajs/jwt";

export const authMacro = new Elysia({ name: "sso" })
  .use(bearer())
  .use(
    jwt({
      secret: process.env.JWT_SECRET as string,
    }),
  )
  .macro({
    isAuth: {
      async resolve({ bearer, status, jwt }) {
        if (!bearer) {
          throw status(401, "Unauthorized");
        }
        const res = await jwt.verify(bearer);
        if (!res) {
          throw status(401, "Unauthorized");
        }

        return {
          userId: res.sub as string,
        };
      },
    },
  });
