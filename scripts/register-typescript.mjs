import * as nodeModule from "node:module";

if (typeof nodeModule.registerHooks === "function") {
  const hooks = await import("./typescript-loader.mjs");
  nodeModule.registerHooks({ resolve: hooks.resolve, load: hooks.load });
} else {
  nodeModule.register("./typescript-loader.mjs", import.meta.url);
}
