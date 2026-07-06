import { join } from "path";
import { existsSync } from "fs";

const PORT = process.env.FRONTEND_PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

console.log(`🚀 Starting frontend development server on http://localhost:${PORT}`);
console.log(`🔗 Proxying API endpoints to: ${BACKEND_URL}`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1️⃣ Serve the compiled react bundle
    if (url.pathname === "/frontend.js") {
      const bundlePath = join(import.meta.dir, "../dist/frontend.js");
      if (existsSync(bundlePath)) {
        return new Response(Bun.file(bundlePath), {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }
      return new Response("Bundle not found. Please compile using 'bun run build.ts' first.", {
        status: 404,
      });
    }

    // 2️⃣ Proxy API requests to backend port 3001
    if (url.pathname.startsWith("/api/")) {
      const targetUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      console.log(`🌐 Proxying ${req.method} request to backend: ${targetUrl}`);
      try {
        const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;
        
        // Forward request
        const response = await fetch(targetUrl, {
          method: req.method,
          headers: {
            "Content-Type": req.headers.get("Content-Type") || "application/json",
          },
          body,
        });

        // Set CORS and response headers
        const clientHeaders = new Headers(response.headers);
        clientHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: clientHeaders,
        });
      } catch (err: any) {
        console.error("❌ Proxy failed to connect to Express backend:", err.message);
        return new Response(
          JSON.stringify({ error: "Backend proxy gateway timeout" }),
          {
            status: 504,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // 3️⃣ Single Page App Fallback: Serve index.html for all non-file route names
    const indexPath = join(import.meta.dir, "index.html");
    if (existsSync(indexPath)) {
      return new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Frontend index.html is missing", { status: 404 });
  },
});
