/** 订单 API 与状态（顾客端 / 商家端共用） */

const ORDER_STATUS = {
  pending: { label: '待付款', className: 'status-pending' },
  paid: { label: '待发货', className: 'status-paid' },
  shipped: { label: '已发货', className: 'status-shipped' },
  completed: { label: '已完成', className: 'status-completed' },
  cancelled: { label: '已取消', className: 'status-cancelled' },
};

function getApiBase() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return '';
  const base = window.APP_CONFIG?.API_BASE || '';
  if (!base || base === 'YOUR_VERCEL_URL') {
    throw new Error('请先配置 config.js 中的 API 地址');
  }
  return base.replace(/\/$/, '');
}

function getApiPath() {
  return window.APP_CONFIG?.API_PATH || '/order';
}

async function apiFetch(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try {
      data = await resp.json();
    } catch {
      if (resp.status === 413) throw new Error('图片过大，请重新截屏后再上传');
      throw new Error('服务器响应异常');
    }
    if (!resp.ok || data.ok === false) {
      if (resp.status === 403) throw new Error('管理密钥不正确，请重新输入');
      if (resp.status === 413 || data.code === 'EXCEED_MAX_PAYLOAD_SIZE') {
        throw new Error('图片过大，请重新截屏后再上传');
      }
      throw new Error(data.error || data.message || `请求失败（${resp.status}）`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('连接超时，请稍后重试');
    if (e.message === 'Load failed' || e.message === 'Failed to fetch') {
      throw new Error('网络异常，请检查网络后重试');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOrder(order) {
  if (!order) return null;
  if (order.data && typeof order.data === 'object' && !order.customer) {
    return { ...order.data, _id: order._id };
  }
  return order;
}

function normalizeOrders(list) {
  return (list || []).map(normalizeOrder).filter(Boolean);
}

async function fetchOrdersByPhone(phone) {
  const url = `${getApiBase()}${getApiPath()}?phone=${encodeURIComponent(phone)}`;
  const data = await apiFetch(url);
  return normalizeOrders(data.orders);
}

async function fetchAllOrders(adminKey) {
  const url = `${getApiBase()}${getApiPath()}?adminKey=${encodeURIComponent(adminKey)}`;
  const data = await apiFetch(url);
  return normalizeOrders(data.orders);
}

async function updateOrderStatus(adminKey, payload) {
  const url = `${getApiBase()}${getApiPath()}`;
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', adminKey, ...payload }),
  });
}

function getMaxUploadPayload() {
  return window.APP_CONFIG?.MAX_UPLOAD_PAYLOAD || 100 * 1024;
}

function buildUploadPayload(orderId, phone, imageBase64) {
  return JSON.stringify({
    action: 'uploadPayment',
    id: orderId,
    phone,
    imageBase64,
  });
}

function fitsUploadPayload(orderId, phone, imageBase64) {
  return buildUploadPayload(orderId, phone, imageBase64).length <= getMaxUploadPayload();
}

let cloudbaseApp = null;

function getCloudbaseApp() {
  if (cloudbaseApp) return cloudbaseApp;
  const envId = window.APP_CONFIG?.ENV_ID;
  if (!envId || typeof cloudbase === 'undefined') return null;
  cloudbaseApp = cloudbase.init({ env: envId });
  return cloudbaseApp;
}

async function ensureCloudbaseAuth(app) {
  const auth = app.auth();
  const loginState = await auth.getLoginState();
  if (!loginState) await auth.signInAnonymously();
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function uploadImageToCloudStorage(orderId, imageBase64) {
  const app = getCloudbaseApp();
  if (!app) return null;
  await ensureCloudbaseAuth(app);
  const file = dataUrlToFile(imageBase64, `payment-${orderId}.jpg`);
  const cloudPath = `payment-proofs/${orderId}-${Date.now()}.jpg`;
  const uploadRes = await app.uploadFile({ cloudPath, filePath: file });
  return uploadRes.fileID;
}

async function uploadPaymentProof(orderId, phone, imageBase64) {
  const url = `${getApiBase()}${getApiPath()}`;

  let fileID = null;
  try {
    fileID = await uploadImageToCloudStorage(orderId, imageBase64);
  } catch {
    fileID = null;
  }

  if (!fileID && !fitsUploadPayload(orderId, phone, imageBase64)) {
    throw new Error('图片过大，请重新截屏后再上传');
  }

  const payload = fileID
    ? { action: 'uploadPayment', id: orderId, phone, fileID }
    : { action: 'uploadPayment', id: orderId, phone, imageBase64 };

  const data = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 45000);
  return normalizeOrder(data.order);
}

function updateLocalOrder(order) {
  const orders = loadOrdersFromLocal();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) orders[idx] = { ...orders[idx], ...order };
  else orders.unshift(order);
  saveOrdersToLocal(orders);
}

function formatFullAddress(customer) {
  if (customer.address) return customer.address;
  return `${customer.province || ''}${customer.city || ''}${customer.district || ''}${customer.detail || ''}`;
}

function getStatusInfo(order) {
  return ORDER_STATUS[order.status] || ORDER_STATUS.pending;
}

function mergeOrders(localOrders, remoteOrders) {
  const map = new Map();
  localOrders.forEach((o) => map.set(o.id, o));
  remoteOrders.forEach((remote) => {
    const local = map.get(remote.id);
    map.set(remote.id, local ? { ...local, ...remote } : remote);
  });
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function saveOrdersToLocal(orders) {
  localStorage.setItem('jiu_my_orders', JSON.stringify(orders));
}

function loadOrdersFromLocal() {
  try {
    return JSON.parse(localStorage.getItem('jiu_my_orders') || '[]');
  } catch {
    return [];
  }
}
