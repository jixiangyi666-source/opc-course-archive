// Cloudflare Pages Functions middleware
// 路由：m1-m8 -> /mN/ 模块档案；app/apex/www -> /app/ 产品演示；opc/pages.dev 原样放行
// 关键：ASSETS.fetch 必须用裸 URL（传原 request 作 init 会变 308 并回落门户）
const ORIGIN = "https://opc-course-archive.pages.dev";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  let targetPath = null;
  const m = /^m([1-8])\.jixiangyi\.cn$/.exec(host);
  if (m) {
    targetPath = url.pathname === "/" ? `/m${m[1]}/index.html` : `/m${m[1]}${url.pathname}`;
  } else if (host === "app.jixiangyi.cn" || host === "jixiangyi.cn" || host === "www.jixiangyi.cn") {
    targetPath = (url.pathname === "/" || url.pathname === "") ? "/app/index.html" : "/app" + url.pathname;
  }
  if (!targetPath) return context.next();

  return context.env.ASSETS.fetch(new URL(targetPath + url.search, ORIGIN));
}