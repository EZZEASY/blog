# 博客访问统计 Cloudflare Worker

使用 GitHub Gist 存储访问数据的 Cloudflare Worker。

## 部署步骤

### 1. 创建 GitHub Gist

1. 访问 https://gist.github.com
2. 创建一个新的 Gist，文件名为 `stats.json`，内容为：
   ```json
   {"pages":{},"totalViews":0,"totalVisitors":0,"visitors":[]}
   ```
3. 保存后，从 URL 复制 Gist ID (格式: `https://gist.github.com/username/GIST_ID`)

### 2. 创建 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `gist` 权限
4. 生成并复制 Token

### 3. 部署 Worker

```bash
# 安装 wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 进入 worker 目录
cd cloudflare-worker

# 设置 secrets
wrangler secret put GITHUB_TOKEN
# 粘贴你的 GitHub Token

wrangler secret put GIST_ID
# 粘贴你的 Gist ID

# 部署
wrangler deploy
```

### 4. 配置博客

部署成功后，Cloudflare 会给你一个 Worker URL，类似：
`https://blog-stats.your-subdomain.workers.dev`

将这个 URL 更新到以下文件：
- `src/components/PageViews.astro` - 第 11 行
- `src/components/Footer.astro` - 第 5 行

## API 接口

### 记录页面访问 (POST)
```
POST /api/views/{slug}
```
返回: `{"views": 123}`

### 获取全站统计 (GET)
```
GET /api/stats
```
返回: `{"totalViews": 1000, "totalVisitors": 500}`
