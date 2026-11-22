// Standalone model/migration runner using the project's existing TypeScript compiler.
// Type safety is checked separately by npm run typecheck.
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

function resolveWithExtension(target, context, nextResolve) {
  const fallback = error => {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || /\.[cm]?[jt]s$/.test(target)) throw error;
    return nextResolve(`${target}.ts`, context);
  };
  try {
    const result = nextResolve(target, context);
    return typeof result.then === "function" ? result.catch(fallback) : result;
  } catch (error) {
    return fallback(error);
  }
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const projectRoot = resolvePath(fileURLToPath(new URL("..", import.meta.url)));
    const target = resolvePath(projectRoot, specifier.slice(2));
    return resolveWithExtension(pathToFileURL(target).href, context, nextResolve);
  }
  return specifier.startsWith(".") ? resolveWithExtension(specifier, context, nextResolve) : nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (!url.endsWith(".ts")) return nextLoad(url, context);
  const source = readFileSync(new URL(url), "utf8");
  return {
    format: "module", shortCircuit: true,
    source: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
  };
}
