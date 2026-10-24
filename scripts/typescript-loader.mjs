// Standalone model/migration runner using the project's existing TypeScript compiler.
// Type safety is checked separately by npm run typecheck.
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const projectRoot = resolvePath(fileURLToPath(new URL("..", import.meta.url)));
    const target = resolvePath(projectRoot, specifier.slice(2));
    try { return await nextResolve(pathToFileURL(target).href, context); }
    catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || /\.[cm]?[jt]s$/.test(target)) throw error;
      return nextResolve(pathToFileURL(`${target}.ts`).href, context);
    }
  }
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".") || /\.[cm]?[jt]s$/.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".ts")) return nextLoad(url, context);
  const source = await readFile(new URL(url), "utf8");
  return {
    format: "module", shortCircuit: true,
    source: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
  };
}
