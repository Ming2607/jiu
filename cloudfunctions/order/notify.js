'use strict';
/** 与 lib/notify.js 保持同步（云函数部署仅包含本目录） */
const https = require('https');

function formatOrderMessage(order) {
  const addr =
    order.customer.address ||
    `${order.customer.province || ''}${order.customer.city || ''}${order.customer.district || ''}${order.customer.detail || ''}`;
  const lines = [
    `【新订单】${order.id}`,
    `时间：${new Date(order.createdAt).toLocaleString('zh-CN')}`,
    `客户：${order.customer.name}`,
    `电话：${order.customer.phone}`,
    `地址：${addr}`,
  ];
  if (order.customer.note) lines.push(`备注：${order.customer.note}`);
  lines.push('---');
  order.items.forEach((i) => {
    lines.push(`${i.name}（${i.spec}）× ${i.qty} = ¥${i.subtotal}`);
  });
  lines.push(`合计：¥${order.total}`);
  return lines.join('\n');
}

function postForm(hostname, path, body) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ code: -1, message: data });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ code: -1, message: e.message }));
    req.write(body);
    req.end();
  });
}

function postJson(url, payload) {
  const u = new URL(url);
  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ errcode: -1, errmsg: data });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ errcode: -1, errmsg: e.message }));
    req.write(body);
    req.end();
  });
}

function notifyServerChan(message, title = '品鉴江南 · 新订单') {
  const key = process.env.SERVERCHAN_SENDKEY?.trim();
  if (!key) return Promise.resolve({ ok: false, error: '未配置 SERVERCHAN_SENDKEY' });

  const body = new URLSearchParams({ title, desp: message }).toString();
  return postForm('sctapi.ftqq.com', `/${key}.send`, body).then((json) =>
    json.code === 0 ? { ok: true } : { ok: false, error: json.message || '发送失败' }
  );
}

function notifyWeCom(message) {
  const url = process.env.WECOM_WEBHOOK_URL?.trim();
  if (!url) return Promise.resolve({ ok: false, error: '未配置 WECOM_WEBHOOK_URL' });
  if (!url.includes('qyapi.weixin.qq.com/cgi-bin/webhook/send')) {
    return Promise.resolve({ ok: false, error: 'WECOM_WEBHOOK_URL 格式不正确' });
  }

  return postJson(url, { msgtype: 'text', text: { content: message } }).then((json) =>
    json.errcode === 0 ? { ok: true } : { ok: false, error: json.errmsg || '企业微信发送失败' }
  );
}

async function notifyOrder(message, title = '品鉴江南 · 新订单') {
  const channels = {};
  const tasks = [];

  if (process.env.WECOM_WEBHOOK_URL?.trim()) {
    tasks.push(notifyWeCom(message).then((r) => { channels.wecom = r; }));
  }
  if (process.env.SERVERCHAN_SENDKEY?.trim()) {
    tasks.push(notifyServerChan(message, title).then((r) => { channels.serverchan = r; }));
  }

  if (!tasks.length) {
    return {
      ok: false,
      error: '未配置 WECOM_WEBHOOK_URL 或 SERVERCHAN_SENDKEY',
      channels,
    };
  }

  await Promise.all(tasks);
  const ok = Object.values(channels).some((r) => r.ok);
  const errors = Object.entries(channels)
    .filter(([, r]) => !r.ok)
    .map(([name, r]) => `${name}: ${r.error}`)
    .join('; ');

  return { ok, channels, error: ok ? undefined : errors || '全部通知渠道失败' };
}

function formatPaymentUploadedMessage(order) {
  const lines = [
    `【已上传付款截图】${order.id}`,
    `客户：${order.customer.name}`,
    `电话：${order.customer.phone}`,
    `合计：¥${order.total}`,
    `请核对后安排发货`,
  ];
  return lines.join('\n');
}

module.exports = {
  formatOrderMessage,
  formatPaymentUploadedMessage,
  notifyServerChan,
  notifyWeCom,
  notifyOrder,
};
