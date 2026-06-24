/** 商家订单管理 */

const ADMIN_KEY_STORAGE = 'jiu_admin_key';
let adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
let orders = [];
let actionOrderId = null;
let actionType = null;
let activeFilter = 'all';
let searchQuery = '';

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(26,24,20,0.88)',
      color: '#F0E8DA',
      padding: '10px 20px',
      borderRadius: '2px',
      fontSize: '13px',
      zIndex: '999',
      maxWidth: '85%',
      textAlign: 'center',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function setLoggedIn(loggedIn) {
  document.getElementById('adminLogin').hidden = loggedIn;
  document.getElementById('adminList').hidden = !loggedIn;
  document.getElementById('refreshBtn').hidden = !loggedIn;
}

function getFilteredOrders() {
  let list = orders.slice();

  if (activeFilter === 'pending') {
    list = list.filter((o) => o.status === 'pending');
  } else if (activeFilter === 'paid') {
    list = list.filter((o) => o.status === 'paid');
  } else if (activeFilter === 'shipped') {
    list = list.filter((o) => o.status === 'shipped');
  } else if (activeFilter === 'completed') {
    list = list.filter((o) => o.status === 'completed');
  }

  const q = searchQuery.trim().toUpperCase();
  if (q) {
    list = list.filter((o) => (o.id || '').toUpperCase().includes(q));
  }

  return list;
}

function updateFilterCounts() {
  document.getElementById('countAll').textContent = orders.length;
  document.getElementById('countPending').textContent = orders.filter((o) => o.status === 'pending').length;
  document.getElementById('countPaid').textContent = orders.filter((o) => o.status === 'paid').length;
  document.getElementById('countShipped').textContent = orders.filter((o) => o.status === 'shipped').length;
  document.getElementById('countCompleted').textContent = orders.filter((o) => o.status === 'completed').length;
}

function updateFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === activeFilter);
  });
}

async function loadOrders() {
  orders = await fetchAllOrders(adminKey);
  renderOrders();
}

function renderOrders() {
  updateFilterCounts();
  updateFilterTabs();

  const container = document.getElementById('adminOrders');
  const list = getFilteredOrders();

  if (!orders.length) {
    container.innerHTML = '<div class="orders-empty">暂无订单</div>';
    return;
  }

  if (!list.length) {
    container.innerHTML = '<div class="orders-empty">没有符合条件的订单</div>';
    return;
  }

  container.innerHTML = list.map(renderAdminOrderCard).join('');
}

function renderAdminOrderCard(order) {
  const st = getStatusInfo(order);
  const date = new Date(order.createdAt).toLocaleString('zh-CN');
  const customer = order.customer || {};
  const addr = formatFullAddress(customer);
  const items = (order.items || [])
    .map((i) => `<li>${i.name}（${i.spec}）× ${i.qty} · ¥${i.subtotal}</li>`)
    .join('');

  let extra = '';
  const extraParts = [];
  if (order.paymentProofUrl) {
    extraParts.push(`<div class="order-extra payment-proof">
      <span>付款截图 <em class="proof-hint">点击查看大图</em></span>
      <button type="button" class="payment-proof-btn" data-proof-url="${order.paymentProofUrl}" aria-label="查看付款截图">
        <img src="${order.paymentProofUrl}" alt="付款截图" class="payment-proof-thumb" />
      </button>
    </div>`);
  }
  if ((order.status === 'shipped' || order.status === 'completed') && order.trackingNo) {
    extraParts.push(`<div class="order-extra">快递单号：<strong>${order.trackingNo}</strong></div>`);
  }
  if (order.status === 'cancelled' && order.cancelReason) {
    extraParts.push(`<div class="order-extra cancel-reason">取消原因：${order.cancelReason}</div>`);
  }
  extra = extraParts.join('');

  let actions = '';
  if (order.status === 'pending') {
    actions = `
      <div class="admin-actions">
        <button class="admin-btn cancel" data-action="cancel" data-id="${order.id}">取消订单</button>
      </div>`;
  } else if (order.status === 'paid') {
    actions = `
      <div class="admin-actions">
        <button class="admin-btn ship" data-action="ship" data-id="${order.id}">标记发货</button>
      </div>`;
  } else if (order.status === 'shipped') {
    actions = `
      <div class="admin-actions">
        <button class="admin-btn complete" data-action="complete" data-id="${order.id}">标记已完成</button>
      </div>`;
  }

  return `
    <div class="order-card admin-order-card">
      <div class="order-card-head">
        <span class="order-id">${order.id}</span>
        <span class="order-status ${st.className}">${st.label}</span>
      </div>
      <div class="order-date">${date}</div>
      <ul class="order-items">${items}</ul>
      <div class="order-customer">
        <div>${customer.name || '—'} · ${customer.phone || '—'}</div>
        <div class="order-address">${addr || '—'}</div>
        ${customer.note ? `<div class="order-note">备注：${customer.note}</div>` : ''}
      </div>
      ${extra}
      <div class="order-meta"><span>合计</span><strong>¥${order.total}</strong></div>
      ${actions}
    </div>`;
}

function openActionModal(type, orderId) {
  actionType = type;
  actionOrderId = orderId;
  const modal = document.getElementById('actionModal');
  const title = document.getElementById('actionModalTitle');
  const body = document.getElementById('actionModalBody');

  if (type === 'ship') {
    title.textContent = '标记已发货';
    body.innerHTML = `
      <p class="action-hint">订单 ${orderId}</p>
      <label><span>快递单号</span>
        <input type="text" id="trackingNoInput" placeholder="请输入快递单号" required />
      </label>
      <button class="submit-btn" id="confirmActionBtn">确认发货</button>`;
  } else if (type === 'complete') {
    title.textContent = '标记已完成';
    body.innerHTML = `
      <p class="action-hint">确认顾客已收到货物？</p>
      <p class="action-hint">订单 ${orderId}</p>
      <button class="submit-btn" id="confirmActionBtn">确认已完成</button>`;
  } else {
    title.textContent = '取消订单';
    body.innerHTML = `
      <p class="action-hint">将向顾客展示取消原因</p>
      <label><span>取消原因</span>
        <textarea id="cancelReasonInput" rows="3" placeholder="如：库存不足、地址无法配送等" required></textarea>
      </label>
      <button class="submit-btn danger" id="confirmActionBtn">确认取消</button>`;
  }

  modal.classList.add('show');
}

function closeActionModal() {
  document.getElementById('actionModal').classList.remove('show');
  actionOrderId = null;
  actionType = null;
}

function openImagePreview(url, title = '付款截图') {
  document.getElementById('imagePreviewTitle').textContent = title;
  document.getElementById('imagePreviewImg').src = url;
  document.getElementById('imagePreviewModal').classList.add('show');
}

function closeImagePreview() {
  document.getElementById('imagePreviewModal').classList.remove('show');
  document.getElementById('imagePreviewImg').src = '';
}

async function confirmAction() {
  const btn = document.getElementById('confirmActionBtn');
  btn.disabled = true;

  try {
    if (actionType === 'ship') {
      const trackingNo = document.getElementById('trackingNoInput').value.trim();
      if (!trackingNo) throw new Error('请填写快递单号');
      await updateOrderStatus(adminKey, {
        id: actionOrderId,
        status: 'shipped',
        trackingNo,
      });
      showToast('已标记发货');
    } else if (actionType === 'complete') {
      await updateOrderStatus(adminKey, {
        id: actionOrderId,
        status: 'completed',
      });
      showToast('已标记完成');
    } else {
      const cancelReason = document.getElementById('cancelReasonInput').value.trim();
      if (!cancelReason) throw new Error('请填写取消原因');
      await updateOrderStatus(adminKey, {
        id: actionOrderId,
        status: 'cancelled',
        cancelReason,
      });
      showToast('订单已取消');
    }
    closeActionModal();
    await loadOrders();
  } catch (e) {
    showToast(e.message || '操作失败');
  } finally {
    btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

async function doLogin() {
  const key = document.getElementById('adminKeyInput').value.trim();
  const btn = document.getElementById('adminLoginBtn');
  if (!key) {
    showLoginError('请输入管理密钥');
    return;
  }
  showLoginError('');
  btn.disabled = true;
  btn.textContent = '验证中…';
  adminKey = key;
  try {
    await loadOrders();
    sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    setLoggedIn(true);
    showLoginError('');
  } catch (e) {
    adminKey = '';
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    showLoginError(e.message || '登录失败，请检查密钥或网络');
  } finally {
    btn.disabled = false;
    btn.textContent = '进入管理';
  }
}

document.getElementById('adminLoginBtn').addEventListener('click', doLogin);

document.getElementById('adminKeyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

document.getElementById('toggleAdminKey').addEventListener('click', () => {
  const input = document.getElementById('adminKeyInput');
  const btn = document.getElementById('toggleAdminKey');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  btn.classList.toggle('show-key', visible);
  btn.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadOrders().catch((e) => showToast(e.message));
});

document.getElementById('adminFilters').addEventListener('click', (e) => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  activeFilter = tab.dataset.filter;
  renderOrders();
});

document.getElementById('orderSearchBtn').addEventListener('click', () => {
  searchQuery = document.getElementById('orderSearchInput').value.trim();
  renderOrders();
});

document.getElementById('orderSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchQuery = e.target.value.trim();
    renderOrders();
  }
});

document.getElementById('orderSearchInput').addEventListener('input', (e) => {
  if (!e.target.value.trim()) {
    searchQuery = '';
    renderOrders();
  }
});

document.getElementById('adminOrders').addEventListener('click', (e) => {
  const proofBtn = e.target.closest('.payment-proof-btn');
  if (proofBtn) {
    openImagePreview(proofBtn.dataset.proofUrl);
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  openActionModal(btn.dataset.action, btn.dataset.id);
});

document.getElementById('closeImagePreview').addEventListener('click', closeImagePreview);

document.getElementById('closeActionModal').addEventListener('click', closeActionModal);
document.getElementById('actionModalBody').addEventListener('click', (e) => {
  if (e.target.id === 'confirmActionBtn') confirmAction();
});

if (adminKey) {
  loadOrders()
    .then(() => setLoggedIn(true))
    .catch(() => {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      adminKey = '';
    });
}
