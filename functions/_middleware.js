// Cloudflare Pages Functions middleware
// 路由：m1-m8 -> /mN/；app/apex/www -> /app/；opc 与 pages.dev 原样放行
// 关键：ASSETS.fetch 必须用"裸 URL"（不带原 request 作 init），否则子请求会被当作外部请求回落门户
const ORIGIN = "https://opc-course-archive.pages.dev";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  if (url.pathname === "/__mw") {
    const a = await context.env.ASSETS.fetch(new URL("/m1/index.html", ORIGIN));
    const ta = ((await a.text()).match(/<title>([^<]*)<\/title>/) || [null, ""])[1];
    const b = await context.env.ASSETS.fetch(new Request(new URL("/m1/index.html", ORIGIN).toString(), context.request));
    const tb = ((await b.text()).match(/<title>([^<]*)<\/title>/) || [null, ""])[1];
    return new Response(`host=${host}\nbareURL=${a.status} ${ta}\nwithInit=${b.status} ${tb}`, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

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