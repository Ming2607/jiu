'use strict';
const cloud = require('@cloudbase/node-sdk');
const { formatOrderMessage, notifyOrder } = require('./notify');

const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

let collectionReady = false;
async function ensureOrdersCollection() {
  if (collectionReady) return;
  try {
    await db.createCollection('orders');
  } catch {
    /* 集合已存在 */
  }
  collectionReady = true;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const STATUS_LABEL = {
  pending: '待处理',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

function respond(statusCode, body) {
  return { statusCode, headers: cors, body: JSON.stringify(body) };
}

function checkAdminKey(key) {
  const expected = process.env.ADMIN_KEY?.trim();
  return expected && key === expected;
}

function normalizeOrderRecord(doc) {
  if (!doc) return null;
  if (doc.data && typeof doc.data === 'object' && !doc.customer) {
    return { ...doc.data, _id: doc._id };
  }
  return doc;
}

function normalizeOrderList(list) {
  return (list || []).map(normalizeOrderRecord).filter(Boolean);
}

function normalizeCustomer(customer) {
  const full =
    customer.address ||
    `${customer.province || ''}${customer.city || ''}${customer.district || ''}${customer.detail || ''}`;
  return { ...customer, address: full };
}

function validateCreate(order) {
  const c = order?.customer;
  if (!c?.name || !c?.phone) return '订单信息不完整';
  if (!/^1[3-9]\d{9}$/.test(String(c.phone))) return '手机号格式不正确';
  if (!c.province || !c.city || !c.district || !c.detail) return '请填写完整收货地址';
  return null;
}

async function createOrder(order) {
  const err = validateCreate(order);
  if (err) return respond(400, { ok: false, error: err });

  await ensureOrdersCollection();

  const now = new Date().toISOString();
  const record = {
    id: order.id || 'ORD' + Date.now(),
    createdAt: order.createdAt || now,
    updatedAt: now,
    status: 'pending',
    statusLabel: STATUS_LABEL.pending,
    customer: normalizeCustomer(order.customer),
    items: order.items || [],
    total: order.total || 0,
  };

  await db.collection('orders').add(record);
  const notify = await notifyOrder(formatOrderMessage(record));

  return respond(200, {
    ok: true,
    id: record.id,
    order: record,
    notified: notify.ok,
    channels: notify.channels,
    notifyError: notify.error,
  });
}

async function listByPhone(phone) {
  if (!/^1[3-9]\d{9}$/.test(String(phone || ''))) {
    return respond(400, { ok: false, error: '手机号无效' });
  }
  await ensureOrdersCollection();
  const { data } = await db
    .collection('orders')
    .where({ 'customer.phone': String(phone) })
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  return respond(200, { ok: true, orders: normalizeOrderList(data) });
}

async function listAllAdmin(adminKey) {
  if (!checkAdminKey(adminKey)) {
    return respond(403, { ok: false, error: '管理密钥不正确' });
  }
  await ensureOrdersCollection();
  const { data } = await db
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return respond(200, { ok: true, orders: normalizeOrderList(data) });
}

async function updateOrder(body) {
  if (!checkAdminKey(body.adminKey)) {
    return respond(403, { ok: false, error: '管理密钥不正确' });
  }

  await ensureOrdersCollection();

  const { id, status } = body;
  if (!id || !status) return respond(400, { ok: false, error: '缺少订单号或状态' });

  const { data: found } = await db.collection('orders').where({ id }).limit(1).get();
  if (!found?.length) return respond(404, { ok: false, error: '订单不存在' });

  const current = normalizeOrderRecord(found[0]);
  if (!current) return respond(404, { ok: false, error: '订单不存在' });

  const patch = {
    status,
    statusLabel: STATUS_LABEL[status] || status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'cancelled') {
    if (current.status !== 'pending') {
      return respond(400, { ok: false, error: '仅待处理订单可以取消' });
    }
    const reason = (body.cancelReason || '').trim();
    if (!reason) return respond(400, { ok: false, error: '请填写取消原因' });
    patch.cancelReason = reason;
  } else if (status === 'shipped') {
    if (current.status !== 'pending') {
      return respond(400, { ok: false, error: '仅待处理订单可以发货' });
    }
    const trackingNo = (body.trackingNo || '').trim();
    if (!trackingNo) return respond(400, { ok: false, error: '请填写快递单号' });
    patch.trackingNo = trackingNo;
    patch.shippedAt = new Date().toISOString();
  } else if (status === 'completed') {
    if (current.status !== 'shipped') {
      return respond(400, { ok: false, error: '仅已发货订单可以标记完成' });
    }
    patch.completedAt = new Date().toISOString();
  } else {
    return respond(400, { ok: false, error: '无效的状态' });
  }

  await db.collection('orders').doc(current._id).update(patch);
  const updated = { ...current, ...patch };

  return respond(200, { ok: true, order: updated });
}

exports.main = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  try {
    const qs = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (qs.adminKey) return listAllAdmin(qs.adminKey);
      if (qs.phone) return listByPhone(qs.phone);
      return respond(400, { ok: false, error: '请提供 phone 或 adminKey 参数' });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (body.action === 'update') return updateOrder(body);
      return createOrder(body);
    }

    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (e) {
    return respond(500, { ok: false, error: e.message || '服务器错误' });
  }
};
