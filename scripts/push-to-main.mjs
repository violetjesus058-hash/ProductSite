// Push local changes to main branch via GitHub REST API (HTTPS push is blocked).
// Usage: node scripts/push-to-main.mjs [message]
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "violetjesus058-hash/ProductSite";
const GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
const COMMIT_MSG = process.argv[2] || "feat: i18n site + analytics referrers + style-label-map";

// --- Safe credential extraction: token stays in JS, never printed ---
function getToken() {
  try {
    const tmpIn = path.join(ROOT, ".git-cred-in.txt");
    const tmpOut = path.join(ROOT, ".git-cred-out.txt");
    fs.writeFileSync(tmpIn, "protocol=https\nhost=github.com\n\n");
    execSync(`"${GIT}" credential fill < "${tmpIn}" > "${tmpOut}"`, { stdio: ["pipe", "pipe", "pipe"], cwd: ROOT, timeout: 15000 });
    const content = fs.readFileSync(tmpOut, "utf8");
    fs.rmSync(tmpIn, { force: true });
    fs.rmSync(tmpOut, { force: true });
    const match = content.match(/password=(\S+)/);
    if (match && /^gh[pousr]_\S+$/.test(match[1])) return match[1];
  } catch {}
  try { fs.rmSync(path.join(ROOT, ".git-cred-in.txt"), { force: true }); fs.rmSync(path.join(ROOT, ".git-cred-out.txt"), { force: true }); } catch {}
  console.error("ERROR: Could not get GitHub token from credential manager.");
  process.exit(1);
}

async function gh(token, method, pathname, body) {
  const url = `https://api.github.com${pathname}`;
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${method} ${pathname} → ${resp.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function b64encode(content) {
  if (typeof content === "string") content = Buffer.from(content, "utf8");
  return content.toString("base64");
}

function expandTree(entry, list = []) {
  const full = path.join(ROOT, entry.path);
  let stat;
  try {
    stat = fs.statSync(full);
  } catch {
    // 已删除的路径无法 stat，直接作为删除项提交
    list.push(entry);
    return list;
  }
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(full)) expandTree({ status: entry.status, path: path.join(entry.path, child) }, list);
  } else {
    list.push(entry);
  }
  return list;
}

function listLocalFiles() {
  // --no-renames：避免 git 把重命名识别成 R，导致旧路径没被删除
  const out = execSync(`"${GIT}" -C "${ROOT}" status --porcelain --no-renames`, { encoding: "utf8" });
  const raw = [];
  for (const line of out.split("\n").filter(Boolean)) {
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    if (rawPath === "scripts/stylelabel-cjk-unique.json") continue;
    if (rawPath.endsWith(".pyc") || rawPath.endsWith(".log") || rawPath.endsWith(".tmp")) continue;
    const pathPart = rawPath.includes("→") ? rawPath.split("→")[1].trim() : rawPath;
    raw.push({ status: status.trim() || "M", path: pathPart });
  }
  const flat = [];
  for (const entry of raw) expandTree(entry, flat);
  // Normalize all paths to forward slashes + dedup
  const seen = new Set();
  return flat
    .map((e) => ({ ...e, path: e.path.replace(/\\/g, "/") }))
    .filter((e) => { if (seen.has(e.path)) return false; seen.add(e.path); return true; });
}

async function main() {
  const token = getToken();
  // 1. Get remote main ref → current commit + tree
  const ref = await gh(token, "GET", `/repos/${REPO}/git/refs/heads/main`);
  const remoteCommitSha = ref.object.sha;
  const parent = await gh(token, "GET", `/repos/${REPO}/git/commits/${remoteCommitSha}`);
  const baseTreeSha = parent.tree.sha;

  const files = listLocalFiles();
  console.log(`Local changes: ${files.length} files. Remote main at ${remoteCommitSha.slice(0, 7)}.`);

  // 1.1. Clean up phantom backslash-path entries from previous Windows push
  const baseTree = await gh(token, "GET", `/repos/${REPO}/git/trees/${baseTreeSha}?recursive=1`);
  const phantomMeta = (baseTree.tree || []).filter((t) => t.path.includes("\\")).map((t) => ({ path: t.path, mode: t.mode, type: t.type, sha: null }));
  if (phantomMeta.length) console.log(`  Found ${phantomMeta.length} phantom backslash paths to delete:`);

  // 1.2. Delete dataset files that exist remotely but no longer locally (renamed product ids).
  // Local git does not track client/public/catalog-data-1, so these never show up in `git status`.
  const PRUNE_PREFIXES = ["client/public/catalog-data-1/products/"];
  const pruneMeta = (baseTree.tree || [])
    .filter((t) => t.type === "blob" && PRUNE_PREFIXES.some((prefix) => t.path.startsWith(prefix)))
    .filter((t) => !fs.existsSync(path.join(ROOT, t.path)))
    .map((t) => ({ path: t.path, mode: t.mode, type: "blob", sha: null }));
  const deletions = [...phantomMeta, ...pruneMeta];

  // 2. Create blobs for modified/new files + delete phantoms
  const blobs = [];
  for (const f of files) {
    if (f.status === "D") { blobs.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
    const fullPath = path.join(ROOT, f.path);
    if (!fs.existsSync(fullPath)) { console.warn(`  SKIP missing: ${f.path}`); continue; }
    const stat = fs.statSync(fullPath);
    if (stat.size > 40_000_000) { console.warn(`  SKIP large (${Math.round(stat.size / 1024)}KB): ${f.path}`); continue; }
    const content = fs.readFileSync(fullPath);
    const blob = await gh(token, "POST", `/repos/${REPO}/git/blobs`, { content: b64encode(content), encoding: "base64" });
    blobs.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    console.log(`  BLOB ${blob.sha.slice(0, 7)}  ${f.path}`);
  }
  for (const p of deletions) {
    blobs.push(p);
    console.log(`  DEL  ${p.path}`);
  }

  // 3. Create new tree (based on remote tree + our changes)
  const tree = await gh(token, "POST", `/repos/${REPO}/git/trees`, { base_tree: baseTreeSha, tree: blobs });
  console.log(`TREE ${tree.sha.slice(0, 7)}  (base ${baseTreeSha.slice(0, 7)})`);

  // 4. Create commit + update ref
  const commit = await gh(token, "POST", `/repos/${REPO}/git/commits`, {
    message: COMMIT_MSG,
    tree: tree.sha,
    parents: [remoteCommitSha],
  });
  console.log(`COMMIT ${commit.sha.slice(0, 7)}`);

  await gh(token, "PATCH", `/repos/${REPO}/git/refs/heads/main`, { sha: commit.sha });
  console.log(`\n✅ Pushed main: ${commit.sha.slice(0, 7)} — ${COMMIT_MSG}`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
