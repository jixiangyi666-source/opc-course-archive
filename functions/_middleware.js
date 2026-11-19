// Cloudflare Pages Functions middleware
// 把 m1..m8.jixiangyi.cn 重写到对应模块目录，www 与 pages.dev 原样放行
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  const m = /^m([1-8])\.jixiangyi\.cn$/.exec(host);
  if (m) {
    const n = m[1];
    const path = url.pathname === "/" ? `/m${n}/index.html` : `/m${n}${url.pathname}`;
    const target = new URL(path + url.search, url.origin);
    return context.env.ASSETS.fetch(new Request(target.toString(), context.request));
  }
  return context.next();
}