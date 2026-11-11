import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Installed agent skills are reference material and bundled tools, not app source.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".agents/skills/**", ".claude/skills/**"]),
]);

export default eslintConfig;
