// Cloudflare Pages Functions middleware
// 路由：m1-m8 -> /mN/；app/apex/www -> /app/；opc 与 pages.dev 原样放行
// 注意：ASSETS 绑定必须用项目规范 origin 取资源，不能用自定义域 origin（否则回落 SPA 首页）
const ORIGIN = "https://opc-course-archive.pages.dev";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  // 自检探针：/__mw 返回 ASSETS 取 /m1/index.html 的真实状态
  if (url.pathname === "/__mw") {
    const r = await context.env.ASSETS.fetch(new URL("/m1/index.html", ORIGIN));
    const body = await r.text();
    return new Response(
      `host=${host} assetsStatus=${r.status} assetsLen=${body.length} title=${(body.match(/<title>([^<]*)<\/title>/) || [null, ""])[1]}`,
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
    );
  }

  let targetPath = null;
  const m = /^m([1-8])\.jixiangyi\.cn$/.exec(host);
  if (m) {
    targetPath = url.pathname === "/" ? `/m${m[1]}/index.html` : `/m${m[1]}${url.pathname}`;
  } else if (host === "app.jixiangyi.cn" || host === "jixiangyi.cn" || host === "www.jixiangyi.cn") {
    targetPath = (url.pathname === "/" || url.pathname === "") ? "/app/index.html" : "/app" + url.pathname;
  }
  if (!targetPath) return context.next();

  const target = new URL(targetPath + url.search, ORIGIN);
  return context.env.ASSETS.fetch(new Request(target.toString(), context.request));
}