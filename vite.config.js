import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: '.',
  base: '/',  // matches Config.CONTENT_BASE — change both together for subpath deploy
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'content', dest: '.' },  // Markdown content files
        { src: 'CNAME',   dest: '.' },  // Custom domain
        { src: 'js',      dest: '.' },  // Classic scripts — copied verbatim (no bundling)
      ],
    }),
  ],
  server: { open: true },
});
