// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: 将 'your-github-username' 替换为你的 GitHub 用户名
  site: 'https://your-github-username.github.io',
  // 如果你的仓库名不是 username.github.io，需要设置 base
  // base: '/lzl-blog',
  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});