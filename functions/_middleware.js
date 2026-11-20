// Cloudflare Pages Functions middleware
// 路由规则（目标布局：主域名=产品，课程门户走子域，m1-m8 模块子域不变）：
//   m1..m8.jixiangyi.cn   -> /m{n}/ 模块档案页
//   app.jixiangyi.cn      -> /app/ 产品演示版（AI 智能机械零件报价系统）
//   jixiangyi.cn（裸域）'/'-> /app/ 产品（裸域接入 Pages 后生效）
//   opc.jixiangyi.cn      -> 原样放行（课程门户专属子域，DNS 添加后生效）
//   www.jixiangyi.cn      -> 原样放行（当前仍为课程门户；opc 生效后再切换为产品）
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
  if (host === "app.jixiangyi.cn" || host === "jixiangyi.cn") {
    const path = (url.pathname === "/" || url.pathname === "") ? "/app/index.html" : "/app" + url.pathname;
    const target = new URL(path + url.search, url.origin);
    return context.env.ASSETS.fetch(new Request(target.toString(), context.request));
  }
  return context.next();
}
