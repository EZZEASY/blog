/**
 * 博客访问统计 Cloudflare Worker
 * 使用 GitHub Gist 作为数据存储
 *
 * 环境变量配置：
 * - GITHUB_TOKEN: GitHub Personal Access Token (需要 gist 权限)
 * - GIST_ID: 存储数据的 Gist ID
 * - ALLOWED_ORIGIN: 允许跨域的域名 (你的博客域名)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getCorsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': allowedOrigin === '*' ? origin : allowedOrigin,
  };
}

// 从 Gist 读取数据
async function getGistData(env) {
  const response = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'Blog-Stats-Worker',
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch gist');
  }

  const gist = await response.json();
  const content = gist.files['stats.json']?.content;

  if (!content) {
    return { pages: {}, totalViews: 0, totalVisitors: 0, visitors: [] };
  }

  return JSON.parse(content);
}

// 更新 Gist 数据
async function updateGistData(env, data) {
  const response = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'Blog-Stats-Worker',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        'stats.json': {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update gist');
  }
}

// 生成访客 ID (基于 IP 的哈希)
async function getVisitorId(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const date = new Date().toISOString().split('T')[0]; // 按天去重
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + date);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 处理文章访问量
async function handlePageView(request, env, slug) {
  const data = await getGistData(env);
  const visitorId = await getVisitorId(request);

  // 初始化页面数据
  if (!data.pages[slug]) {
    data.pages[slug] = { views: 0, visitors: [] };
  }

  // 增加访问量
  data.pages[slug].views += 1;
  data.totalViews = (data.totalViews || 0) + 1;

  // 检查是否是新访客
  if (!data.visitors) data.visitors = [];
  if (!data.visitors.includes(visitorId)) {
    data.visitors.push(visitorId);
    data.totalVisitors = data.visitors.length;
  }

  // 页面级别访客统计
  if (!data.pages[slug].visitors.includes(visitorId)) {
    data.pages[slug].visitors.push(visitorId);
  }

  // 限制存储的访客 ID 数量 (防止数据过大)
  if (data.visitors.length > 10000) {
    data.visitors = data.visitors.slice(-5000);
  }
  if (data.pages[slug].visitors.length > 1000) {
    data.pages[slug].visitors = data.pages[slug].visitors.slice(-500);
  }

  await updateGistData(env, data);

  return { views: data.pages[slug].views };
}

// 获取全站统计
async function handleSiteStats(env) {
  const data = await getGistData(env);
  return {
    totalViews: data.totalViews || 0,
    totalVisitors: data.totalVisitors || (data.visitors?.length || 0),
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = getCorsHeaders(origin, env);

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 文章访问量 API
      const pageViewMatch = url.pathname.match(/^\/api\/views\/(.+)$/);
      if (pageViewMatch && request.method === 'POST') {
        const slug = decodeURIComponent(pageViewMatch[1]);
        const result = await handlePageView(request, env, slug);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 全站统计 API
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const result = await handleSiteStats(env);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 404
      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
