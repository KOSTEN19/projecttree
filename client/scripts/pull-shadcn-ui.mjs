/**
 * Тянет компоненты UI из реестра ui.shadcn.com (тот же источник, что CLI/MCP shadcn).
 * Повтор при сетевых сбоях (ECONNRESET и т.п.) — актуально для CI/Docker.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const components = [
  "alert",
  "avatar",
  "badge",
  "button",
  "card",
  "dialog",
  "input",
  "label",
  "separator",
  "skeleton",
];
const npmArgs = [
  "exec",
  "--",
  "shadcn",
  "add",
  ...components,
  "--overwrite",
  "--yes",
];

const attempts = 5;
const env = { ...process.env, CI: "true" };

for (let i = 1; i <= attempts; i++) {
  const r = spawnSync("npm", npmArgs, { cwd: root, stdio: "inherit", env });
  if (r.status === 0) process.exit(0);
  console.error(`pull-shadcn-ui: попытка ${i}/${attempts} не удалась (код ${r.status ?? r.signal})`);
  if (i < attempts) await delay(1500 * i);
}

process.exit(1);
