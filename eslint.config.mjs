import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    // Everything under src/components is shipped to the browser or one import
    // away from it, so it may only read the public half of the environment.
    // src/lib/env/server.ts holds the connection string, the auth secret and
    // the API key; importing it here would inline them into the client bundle.
    files: ["src/components/**", "src/lib/auth-client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/env/server", "**/env/server"],
              message:
                "Client-side code may only read @/lib/env/client — the server env holds secrets.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
