import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { router } from "./router";

// A bare relative string ("/rpc") makes RPCLink's internal `new URL(...)`
// call throw ("Invalid URL") — it needs an absolute URL, so resolve one
// against the current origin at call time (this module only runs client-side).
const link = new RPCLink({ url: () => `${window.location.origin}/rpc` });

export const orpc: RouterClient<typeof router> = createORPCClient(link);
