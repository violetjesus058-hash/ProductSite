import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("full-stack development scripts", () => {
  it("starts the Express/tRPC server in development", () => {
    expect(packageJson.scripts.dev).toContain("server/_core/index.ts");
    expect(packageJson.scripts.dev).toContain("NODE_ENV=development");
  });

  it("bundles the same full-stack server for production", () => {
    expect(packageJson.scripts.build).toContain("esbuild server/_core/index.ts");
  });
});
