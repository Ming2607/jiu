/** 订单 API 与状态（顾客端 / 商家端共用） */

const ORDER_STATUS = {
  pending: { label: '待处理', className: 'status-pending' },
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

async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try {
      data = await resp.json();
    } catch {
      throw new Error('服务器响应异常');
    }
    if (!resp.ok || data.ok === false) {
      if (resp.status === 403) throw new Error('管理密钥不正确，请重新输入');
      throw new Error(data.error || `请求失败（${resp.status}）`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('连接超时，请稍后重试');
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
