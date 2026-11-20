// Cloudflare Pages Function: POST /api/chat -> 智谱 GLM（密钥只放服务端环境变量）
// 环境变量：ZHIPU_API_KEY（必填）、ZHIPU_MODEL（可选，默认 glm-4-flash）

const SYSTEM = `你是「AI 智能机械零件报价系统」站内的使用助手，用户是 3-10 人小型机加工厂的老板或报价员。
只回答两类问题：这个演示页面怎么用；与报价流程直接相关的小疑问（材料、费率、终审、探价、导出、历史）。

八个页面与界面上的原词（回答要照抄这些词，不要另造按钮名）：
1 任务台：按钮「新建报价」进上传解析、「快速探价」进探价模式；表格列 任务编号/零件记录/状态/金额/创建时间；状态标签 解析中、待终审、已确认、探价、已驳回。
2 上传解析：点「拖拽 STEP / 图片 / PDF 到这里」只会提示用预置样本；点下方三张样本卡（带孔板 50x40x10、立方块 40x30x20、支架零件）开始解析，约 2 秒出 7 项结果：材料（AI推测·待核，下拉可改）、包络尺寸、体积、孔候选、单位、技术要求、数量；底部按钮「先探个价」「去报价」。
3 探价模式：三项已预填（材料类别、包络尺寸如 50 x 40 x 10、数量），点「快速算价」出「参考价格区间（N 件）」，不含底价与明细；卡片下「存为探价记录」「转正式报价」。
4 多方案：三张卡 方案A 常规加工 / 方案B 优化工艺 / 方案C 换材料 45钢，点卡切档；下方六项成本表（材料费/工时费/刀具耗材/装夹准备/其他费用/利润）每行带计算依据；按钮「选定方案 X，去终审」。
5 终审：上方「假设项与低置信项」；下方「报价依据单」前五行金额是可编辑输入框，改完「报价合计」实时重算；按钮「驳回重算」（弹窗填原因，不填默认未填原因）和「确认报价，生成报价单」。
6 报价单：含报价编号、零件、材料、数量、六行依据、报价合计；按钮「打印导出」「存入历史」；打印时目标选另存为 PDF。
7 费率表：上半「核心参数」8 项可编辑（三轴数控铣小时费率、人工费率、毛坯单边余量、准备工时、孔附加工时、默认利润率、探价区间宽度、材料损耗率），按钮「保存为新版本」；下半是材料库/设备费率/工时规则/刀具摊销/利润规则/探价规则六组，其中材料单价等为只读展示。
8 历史报价：搜索框按编号或零件名过滤；点行看详情，有修改时间线、「复制为新报价」、补录实际工时与实际成本的「保存补录」。

已知限制（问到就直说，不要绕）：演示版不接真实文件上传；材料人工确认只改标注、报价仍按预置样本材料算；正式流按 1 件算，批量没做；刷新页面会丢未确认的改价；历史记录没存参数版本。

回答规则：先给 1-3 步照做动作，再一句解释；总长不超过 120 字；不编造价格、不承诺交期、不给底价；
不用表情符号；中文口语短句；不知道就说这一项演示版还没有。
示例（照这个密度回答）：
问：这个页面怎么用（当前页面：任务台）
答：1 上方三个数字卡先看量：报价任务、已确认报价、探价记录；2 点「新建报价」开一单，或点「快速探价」先给客户一个区间；3 表格点任意一行看任务。任务台只做分派，不在这里算价。
问：探价怎么填最快（当前页面：探价模式）
答：1 材料类别保持预填；2 包络尺寸按 长 x 宽 x 高 改，中间用英文小写 x；3 数量填件数，点「快速算价」。三项齐了立刻出区间，不含底价。
问：改完材料价格为什么没变
答：演示版这个字段只改标注状态，报价仍按预置样本材料算；想看真正换材料的价，去多方案点方案C（换材料 45钢）。正式版才联动重算。有。`;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet() {
  return json({ ok: true, hint: "POST {messages:[{role,content}], context:{page,note}}" });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const key = env.ZHIPU_API_KEY || env.GLM_API_KEY || "";
  if (!key) return json({ error: "服务端未配置 ZHIPU_API_KEY" }, 503);

  const history = Array.isArray(body.messages) ? body.messages : [];
  const msgs = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));

  if (!msgs.length) return json({ error: "没有可回答的问题" }, 400);

  const ctx = body.context || {};
  const ctxLine =
    "用户当前页面：" + (ctx.page || "未知") + (ctx.note ? "；页面状态：" + ctx.note : "");

  const payload = {
    model: env.ZHIPU_MODEL || "glm-4-flash",
    messages: [{ role: "system", content: SYSTEM }, { role: "system", content: ctxLine }].concat(msgs),
    temperature: 0.2,
    max_tokens: 700,
    stream: false,
  };

  let r;
  try {
    r = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "调用模型网络失败：" + String(e).slice(0, 120) }, 502);
  }

  const text = await r.text();
  if (!r.ok) {
    return json({ error: "模型返回 " + r.status + "：" + text.slice(0, 200) }, 502);
  }

  let d;
  try {
    d = JSON.parse(text);
  } catch (e) {
    return json({ error: "模型返回非 JSON" }, 502);
  }

  const choice = (d.choices && d.choices[0]) || {};
  const msg = choice.message || {};
  const reply = (msg.content || msg.reasoning_content || "").trim();
  if (!reply) return json({ error: "模型返回空内容" }, 502);

  return json({ reply: reply, model: payload.model });
}