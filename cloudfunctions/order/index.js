'use strict';
const cloud = require('@cloudbase/node-sdk');
const { formatOrderMessage, formatPaymentUploadedMessage, notifyOrder } = require('./notify');

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
  pending: '待付款',
  paid: '待发货',
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

async function refreshPaymentProofUrls(orders) {
  const fileIds = [...new Set(orders.map((o) => o.paymentProofFileId).filter(Boolean))];
  if (!fileIds.length) return orders;
  try {
    const { fileList } = await app.getTempFileURL({ fileList: fileIds });
    const map = Object.fromEntries(fileList.map((f) => [f.fileID, f.tempFileURL]));
    return orders.map((o) =>
      o.paymentProofFileId
        ? { ...o, paymentProofUrl: map[o.paymentProofFileId] || o.paymentProofUrl }
        : o
    );
  } catch {
    return orders;
  }
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
  const orders = await refreshPaymentProofUrls(normalizeOrderList(data));
  return respond(200, { ok: true, orders });
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
  const orders = await refreshPaymentProofUrls(normalizeOrderList(data));
  return respond(200, { ok: true, orders });
}

async function uploadPayment(body) {
  const { id, phone, imageBase64, fileID } = body;
  if (!id || !phone || (!imageBase64 && !fileID)) {
    return respond(400, { ok: false, error: '参数不完整' });
  }

  await ensureOrdersCollection();

  const { data: found } = await db.collection('orders').where({ id }).limit(1).get();
  if (!found?.length) return respond(404, { ok: false, error: '订单不存在' });

  const current = normalizeOrderRecord(found[0]);
  if (!current) return respond(404, { ok: false, error: '订单不存在' });
  if (String(current.customer?.phone) !== String(phone)) {
    return respond(403, { ok: false, error: '手机号与订单不匹配' });
  }
  if (current.status !== 'pending') {
    return respond(400, { ok: false, error: '该订单已上传过付款截图或不可再上传' });
  }

  let paymentProofFileId;
  let paymentProofUrl = '';

  if (fileID) {
    paymentProofFileId = fileID;
    try {
      const { fileList } = await app.getTempFileURL({ fileList: [fileID] });
      paymentProofUrl = fileList[0]?.tempFileURL || '';
    } catch {
      paymentProofUrl = '';
    }
  } else {
    const base64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return respond(400, { ok: false, error: '图片格式无效' });
    }
    if (buffer.length > 900 * 1024) {
      return respond(400, { ok: false, error: '图片过大，请压缩后重试' });
    }

    const cloudPath = `payment-proofs/${id}-${Date.now()}.jpg`;
    const uploadRes = await app.uploadFile({ cloudPath, fileContent: buffer });
    paymentProofFileId = uploadRes.fileID;
    const { fileList } = await app.getTempFileURL({ fileList: [paymentProofFileId] });
    paymentProofUrl = fileList[0]?.tempFileURL || '';
  }

  const patch = {
    status: 'paid',
    statusLabel: STATUS_LABEL.paid,
    paymentProofFileId: paymentProofFileId,
    paymentProofUrl,
    paidAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('orders').doc(current._id).update(patch);
  const updated = { ...current, ...patch };

  await notifyOrder(formatPaymentUploadedMessage(updated), '品鉴江南 · 付款截图');

  return respond(200, { ok: true, order: updated });
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
      return respond(400, { ok: false, error: '仅待付款订单可以取消' });
    }
    const reason = (body.cancelReason || '').trim();
    if (!reason) return respond(400, { ok: false, error: '请填写取消原因' });
    patch.cancelReason = reason;
  } else if (status === 'shipped') {
    if (current.status !== 'paid') {
      return respond(400, { ok: false, error: '请先确认顾客已上传付款截图' });
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
      if (body.action === 'uploadPayment') return uploadPayment(body);
      return createOrder(body);
    }

    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (e) {
    return respond(500, { ok: false, error: e.message || '服务器错误' });
  }
};
