/**
 * Đóng gói API server thành 1 file JS (chạy bằng Node portable trong bản .exe)
 */
import * as esbuild from "esbuild";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist-server");

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "server/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: join(outdir, "index.cjs"),
  external: ["node:sqlite"],
  sourcemap: false,
  logLevel: "info",
  banner: {
    js: 'var import_meta_url=require("url").pathToFileURL(__filename).href;',
  },
  define: {
    "import.meta.url": "import_meta_url",
  },
});

console.log("Server bundle:", join(outdir, "index.cjs"));
