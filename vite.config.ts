import { defineConfig } from 'vite';

const BILI_API = 'https://api.bilibili.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Bilibili 的接口不返回 CORS 头，浏览器直连一定会被拦。
 * 所以走同源的 /bili 前缀，由 Vite 开发 / 预览服务器反代到 api.bilibili.com，
 * 并补上 B 站风控要求的 Referer 与 UA。
 */
const proxy = {
  '/bili': {
    target: BILI_API,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/bili/, ''),
    headers: {
      Referer: 'https://www.bilibili.com/',
      Origin: 'https://www.bilibili.com',
      'User-Agent': UA,
    },
  },
};

export default defineConfig({
  server: {
    port: 5319,
    strictPort: true,
    proxy,
  },
  preview: {
    port: 5319,
    strictPort: true,
    proxy,
  },
  build: {
    target: 'es2022',
  },
});
