import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "dist", "public");
const target = path.join(root, ".vitepress", "dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await writeFile(path.join(target, "_redirects"), "/* /index.html 200\n", "utf8");
console.log(`Deployment output synced: ${path.relative(root, target)}`);
