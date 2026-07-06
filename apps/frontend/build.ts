import Bun from "bun";
import { join } from "path";
import { mkdirSync } from "fs";

async function runBuild() {
  console.log("📦 Starting frontend compilation via Bun.build...");

  // Ensure dist folder exists
  try {
    mkdirSync(join(import.meta.dir, "dist"), { recursive: true });
  } catch (e) {}

  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src/frontend.tsx")],
    outdir: join(import.meta.dir, "dist"),
    minify: true,
    sourcemap: "none",
  });

  if (!result.success) {
    console.error("❌ Frontend compilation failed:");
    result.logs.forEach((log) => console.error(log));
    process.exit(1);
  }

  console.log("🚀 Frontend compilation completed successfully. Output in apps/frontend/dist/");
}

runBuild();
