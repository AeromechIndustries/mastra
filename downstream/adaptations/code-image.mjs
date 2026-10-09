/** Build checked, narrow embedding adaptations without changing installed packages. */
import { build } from "esbuild";
import {
  readFile,
  mkdir,
  copyFile,
  writeFile,
  rename,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
function replaceExactly(source, needle, replacement) {
  if (source.split(needle).length !== 2)
    throw new Error(`Upstream embedding seam changed: ${needle}`);
  return source.replace(needle, replacement);
}
export async function buildCodeRuntime(directory) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "credentials-disabled.json"), "{}\n");
  await writeFile(
    path.join(directory, "NOTICE"),
    "TessarAct Code — Aeromech Industries\nBased on Mastra Code 0.44.1 and @mastra/code-sdk 1.10.1, Apache-2.0.\nUpstream files are modified for terminal transport, application-owned inference, credential boundaries and branding.\nSee MASTRA-CODE-LICENSE and MASTRA-CODE-SDK-LICENSE.\n"
  );
  await build({
    absWorkingDir: repository,
    entryPoints: ["server/src/features/code/processMain.ts"],
    bundle: true,
    platform: "node",
    target: "node22.19",
    format: "esm",
    outfile: path.join(directory, "code.mjs"),
    packages: "external",
    define: { MASTRACODE_VERSION: '"0.44.1"' },
  });
  await build({
    absWorkingDir: repository,
    entryPoints: [
      "server/src/features/code/composition.ts",
      "server/src/features/code/processTerminal.ts",
      "server/src/features/code/processModel.ts",
    ],
    bundle: true,
    packages: "external",
    platform: "node",
    target: "node22.19",
    format: "esm",
    outdir: directory,
    outExtension: { ".js": ".mjs" },
  });
  // Copy the pinned upstream packages to the protected image, applying only checked seams.
  const adaptations = [
    [
      "@mastra/code-sdk",
      "dist/agents/model.js",
      "function resolveModel(modelId, options) {",
      "function resolveModel(modelId, options) {\n\tif (globalThis.tessaractCodeModel) return globalThis.tessaractCodeModel(modelId, options?.thinkingLevel);",
    ],
    [
      "@mastra/code-sdk",
      "dist/utils/project.js",
      "function getAppDataDir() {",
      "function getAppDataDir() {\n\tif (process.env.TESSARACT_CODE_STATE_DIRECTORY) return process.env.TESSARACT_CODE_STATE_DIRECTORY;",
    ],
  ];
  // This file is applied to a staged production deployment, never the worktree node_modules.
  for (const [name, file, needle, replacement] of adaptations) {
    const source = await readFile(
      path.join(repository, "node_modules", name, file),
      "utf8"
    );
    replaceExactly(source, needle, replacement);
  }
  for (const name of ["mastracode", "@mastra/code-sdk"]) {
    const manifest = JSON.parse(
      await readFile(
        path.join(repository, "node_modules", name, "package.json"),
        "utf8"
      )
    );
    if (
      manifest.version !== (name === "mastracode" ? "0.44.1" : "1.10.1") ||
      manifest.license !== "Apache-2.0"
    )
      throw new Error("Code runtime version or attribution changed.");
    await copyFile(
      path.join(repository, "node_modules", name, "LICENSE.md"),
      path.join(
        directory,
        name === "mastracode"
          ? "MASTRA-CODE-LICENSE"
          : "MASTRA-CODE-SDK-LICENSE"
      )
    );
  }
}
export async function adaptStagedCodeRuntime(deployment) {
  // Re-stage only these pinned upstream files so adaptation is repeatable.
  const upstreamFiles = [
    ["@mastra/code-sdk", "dist/agents/model.js"],
    ["@mastra/code-sdk", "dist/utils/project.js"],
    ["@mastra/code-sdk", "dist/index.js"],
    ["@mastra/code-sdk", "dist/auth/account-rotation-processor.js"],
  ];
  const upstreamTuiFiles = await readdir(
    path.join(repository, "node_modules/mastracode/dist")
  );
  const upstreamTui = upstreamTuiFiles.filter((file) =>
    /^tui-.*\.js$/.test(file)
  );
  if (upstreamTui.length !== 1)
    throw new Error("Native TUI bundle identity changed.");
  upstreamFiles.push(["mastracode", `dist/${upstreamTui[0]}`]);
  for (const [name, relative] of upstreamFiles) {
    const target = path.join(deployment, "node_modules", name, relative);
    await copyFile(
      path.join(repository, "node_modules", name, relative),
      `${target}.tessaract-stage`
    );
    await rename(`${target}.tessaract-stage`, target);
  }
  async function adapt(name, relative, needle, replacement) {
    const file = path.join(deployment, "node_modules", name, relative);
    const source = await readFile(file, "utf8");
    const result = replaceExactly(source, needle, replacement);
    // Replace a staged hard link instead of mutating the pnpm store.
    await writeFile(`${file}.tessaract-stage`, result);
    await rename(`${file}.tessaract-stage`, file);
  }
  await adapt(
    "@mastra/code-sdk",
    "dist/agents/model.js",
    "function resolveModel(modelId, options) {",
    "function resolveModel(modelId, options) {\n\tif (globalThis.tessaractCodeModel) return globalThis.tessaractCodeModel(modelId, options?.thinkingLevel);"
  );
  await adapt(
    "@mastra/code-sdk",
    "dist/utils/project.js",
    "function getAppDataDir() {",
    "function getAppDataDir() {\n\tif (process.env.TESSARACT_CODE_STATE_DIRECTORY) return process.env.TESSARACT_CODE_STATE_DIRECTORY;"
  );
  await adapt(
    "@mastra/code-sdk",
    "dist/agents/model.js",
    "const primary = resolveModel(modelId, resolveOptions);",
    "const primary = resolveModel(modelId, resolveOptions);\n\tif (globalThis.tessaractCodeModel) return primary;"
  );
  await adapt(
    "@mastra/code-sdk",
    "dist/agents/model.js",
    "function resolvePackMemoryModelChain(settings, startPackId, resolveOptions) {",
    `function resolvePackMemoryModelChain(settings, startPackId, resolveOptions) {
    if (globalThis.tessaractCodeModel) {
      const pack = listResolvableModePacks(settings).find((entry) => entry.id === startPackId);
      const memory = pack && resolveModePackModels(settings, pack).memory;
      return memory ? resolveModel(memory, resolveOptions) : undefined;
    }`
  );
  const sdk = path.join(
    deployment,
    "node_modules/@mastra/code-sdk/dist/index.js"
  );
  const source = await readFile(sdk, "utf8");
  const subagent =
    /resolveSubagentModel: \(modelId, \{ requestContext \}\) => routesToOtherGateway\([\s\S]*?\? modelId : resolveModel\(modelId, \{ requestContext \}\),/g;
  if ([...source.matchAll(subagent)].length !== 1)
    throw new Error("Native subagent resolver seam changed.");
  const managedAuth = replaceExactly(
    source,
    "const authStorage = new AuthStorage();",
    'const authStorage = new AuthStorage(globalThis.tessaractCodeModel ? "/opt/tessaract-code/credentials-disabled.json" : undefined);'
  );
  await writeFile(
    `${sdk}.tessaract-stage`,
    managedAuth.replace(
      subagent,
      "resolveSubagentModel: (modelId, { requestContext }) => resolveModel(modelId, { requestContext }),"
    )
  );
  await rename(`${sdk}.tessaract-stage`, sdk);
  await adapt(
    "@mastra/code-sdk",
    "dist/auth/account-rotation-processor.js",
    "async processAPIError(args) {",
    "async processAPIError(args) {\n\tif (globalThis.tessaractCodeModel) return { retry: false };"
  );
  const files = await readdir(
    path.join(deployment, "node_modules/mastracode/dist")
  );
  const tui = files.find((file) => /^tui-.*\.js$/.test(file));
  if (!tui) throw new Error("Native TUI entrypoint changed.");
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "class MastraTUI {",
    "class MastraTUI {\n\tredraw() { this.state.ui.requestRender(true); }"
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "async run() {\n\t\tawait this.init();",
    "async run() {\n\t\tawait this.init();\n\t\tif (globalThis.tessaractCodeStartupNotice) showInfo(this.state, globalThis.tessaractCodeStartupNotice);"
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "async handleSlashCommand(input) {",
    `async handleSlashCommand(input) {
    if (globalThis.tessaractCodeModel) {
      if (/^\\/(?:login|logout|connect|setup|update|prune|profile|mcp|hooks|plugins|schedules|browser|voice|custom-providers|memory-gateway|observability)(?:\\s|$)/.test(input)) {
        showInfo(this.state, "This capability is managed in TessarAct and is not available inside this Code preview."); return true;
      }
      if (input.trim() === "/files") { globalThis.tessaractCodeOpenFiles?.(); return true; }
    }`
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "async performLogin(providerId) {",
    'async performLogin(providerId) {\n\tif (globalThis.tessaractCodeModel) { showInfo(this.state, "Connect providers through TessarAct account settings."); return; }'
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "async checkForUpdate(passive = false) {",
    "async checkForUpdate(passive = false) {\n\tif (globalThis.tessaractCodeModel) return;"
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    'if (name !== "Mastra Code") return',
    'if (name !== "Mastra Code" && name !== "TessarAct Code") return'
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "const cols = process.stdout.columns || 80;",
    "const cols = globalThis.tessaractCodeColumns?.() || process.stdout.columns || 80;"
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "if (cols < 30) return",
    'if (cols < (name === "TessarAct Code" ? 37 : 30)) return'
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    "const coloredLines = (cols >= 50 ? FULL_ART : SHORT_ART).map((line) => colorLine(line));",
    `const tessaract = [
    "▀█▀ █▀▀ █▀ █▀ ▄▀█ █▀█ ▄▀█ █▀▀ ▀█▀",
    " █  █▀▀ ▀█ ▀█ █▀█ █▀▄ █▀█ █    █ ",
    " ▀  ▀▀▀ ▀▀ ▀▀ ▀ ▀ ▀ ▀ ▀ ▀ ▀▀▀  ▀ "
  ];
  const code = ["█▀▀ █▀█ █▀▄ █▀▀", "█   █ █ █ █ █▀▀", "▀▀▀ ▀▀▀ ▀▀  ▀▀▀"];
  const art = name === "TessarAct Code" ? (cols >= 56 ? tessaract.map((line, i) => line + "   " + code[i]) : tessaract) : (cols >= 50 ? FULL_ART : SHORT_ART);
  const coloredLines = art.map((line) => colorLine(line));
  if (name === "TessarAct Code") coloredLines.push(theme.fg("dim", "Aeromech Industries"));`
  );
  await adapt(
    "mastracode",
    `dist/${tui}`,
    'theme.fg("accent", "Mastra Code")) + theme.fg("dim", ` v${version}`);',
    'theme.fg("accent", name)) + theme.fg("dim", ` v${version}`);'
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  if (process.argv[2] === "--adapt")
    await adaptStagedCodeRuntime(path.resolve(process.argv[3]));
  else
    await buildCodeRuntime(
      path.resolve(process.argv[2] ?? "dist/code-runtime")
    );
