import { publicRouter } from "./routers/public";
import { adminRouter } from "./routers/admin";
import { clientRouter } from "./routers/client";

export const router = {
  ...publicRouter,
  admin: adminRouter,
  client: clientRouter,
};
