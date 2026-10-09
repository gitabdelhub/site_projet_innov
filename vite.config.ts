import { existsSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// In development, serve the Vercel functions of /api from the Vite server,
// so `npm run dev` behaves like the deployed site.
const vercelApiInDev = (): Plugin => ({
  name: 'vercel-api-in-dev',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split('?')[0] ?? '';
      if (!/^\/api\/[a-z-]+$/.test(path)) return next();
      if (!existsSync(`.${path}.ts`)) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Not found' }));
      }
      try {
        const mod = await server.ssrLoadModule(`${path}.ts`);
        const handler = mod[req.method ?? 'GET'];
        if (typeof handler !== 'function') {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        const response: Response = await handler(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        server.config.logger.error(String(error));
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
  },
})

export default defineConfig(({ mode }) => {
  // Make .env values (including the server-only service key) visible to /api in dev
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), vercelApiInDev()],
    server: {
      port: 3000
    }
  }
})
