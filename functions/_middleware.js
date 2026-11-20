// Cloudflare Pages Functions middleware
// 路由：m1-m8 -> /mN/ 模块档案；app/apex/www -> /app/ 产品演示；/api/* -> Functions 自身
// 关键：ASSETS.fetch 必须用裸 URL（传原 request 作 init 会变 308 并回落门户）
const ORIGIN = "https://opc-course-archive.pages.dev";

// 报价后端（阿里云 ECS，HTTP 80；TLS 由 Cloudflare 边缘终结）
// 注意：必须用域名不能用裸 IP——Cloudflare Function fetch 裸 IP 会被边缘 1003 拒绝
const QUOTE_BACKEND = "http://8.136.0.202.nip.io";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  // /api/v1/* -> 阿里云报价后端（2026-11-20 新增：产品页真实上传/解析）
  if (path.startsWith("/api/v1/")) {
    try {
      const backendReq = new Request(QUOTE_BACKEND + path + url.search, context.request);
      return await fetch(backendReq);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { code: "dependency_unavailable", message: "报价后端不可达: " + String(err).slice(0, 140) } }),
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }
  }

  // 站内 AI 助手等函数路由：直接交给 Functions，不要走静态资源
  if (path.startsWith("/api/")) return context.next();

  let targetPath = null;

  const m = /^m([1-8])\.jixiangyi\.cn$/.exec(host);
  if (m) {
    targetPath = path === "/" ? `/m${m[1]}/index.html` : `/m${m[1]}${path}`;
  } else if (host === "app.jixiangyi.cn" || host === "jixiangyi.cn" || host === "www.jixiangyi.cn") {
    if (path === "/" || path === "/app" || path === "/app/") targetPath = "/app/index.html";
    else if (path.startsWith("/app/")) targetPath = path; // /app/x 已经是 app 目录下的真实路径，不再拼前缀
    else targetPath = "/app" + path;
  }

  if (!targetPath) return context.next();

  return context.env.ASSETS.fetch(new URL(targetPath + url.search, ORIGIN));
}