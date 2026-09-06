import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The entrypoint is what makes a launched container migrate itself, so these
 * exercise the real script — with a stub `npm` ahead of the real one on PATH,
 * which records the arguments it was called with and fails on demand.
 */
const script = resolve(import.meta.dirname, "docker-entrypoint.sh");

type Run = { status: number; stdout: string; calls: string[] };

function run(
  args: string[],
  env: Record<string, string> = {},
  { npmFails = false } = {},
): Run {
  const dir = mkdtempSync(join(tmpdir(), "entrypoint-"));
  const bin = join(dir, "bin");
  const log = join(dir, "npm-calls.log");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "npm"),
    `#!/bin/sh\necho "$@" >> ${log}\nexit ${npmFails ? 1 : 0}\n`,
    { mode: 0o755 },
  );
  writeFileSync(log, "");

  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync("sh", [script, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        DB_MIGRATE_RETRY_SECONDS: "0",
        ...env,
      },
    });
  } catch (error) {
    const failure = error as { status: number; stdout: string };
    status = failure.status;
    stdout = failure.stdout;
  }

  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
  return { status, stdout, calls };
}

describe("docker-entrypoint.sh", () => {
  it("applies migrations before handing over to the command", () => {
    const { status, stdout, calls } = run(["echo", "serving"]);

    expect(calls).toEqual(["run db:migrate"]);
    expect(stdout).toContain("serving");
    expect(status).toBe(0);
  });

  it("retries a failing migration up to the attempt limit, then refuses to serve", () => {
    // Exiting beats starting the app: a container serving requests against a
    // schema the code does not expect is worse than one that never comes up.
    const { status, stdout, calls } = run(
      ["echo", "serving"],
      { DB_MIGRATE_ATTEMPTS: "3" },
      { npmFails: true },
    );

    expect(calls).toHaveLength(3);
    expect(stdout).not.toContain("serving");
    expect(status).toBe(1);
  });

  it("skips migrations when SKIP_DB_MIGRATE is set, for replicas that must not race", () => {
    const { status, stdout, calls } = run(["echo", "serving"], {
      SKIP_DB_MIGRATE: "1",
    });

    expect(calls).toEqual([]);
    expect(stdout).toContain("serving");
    expect(status).toBe(0);
  });
});
