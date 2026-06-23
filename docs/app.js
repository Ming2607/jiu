/** 品鉴江南伴手礼 — 前端逻辑 */

function assetUrl(path) {
  if (!path || path.startsWith('http')) return path;
  const base = window.__BASE__ || '/';
  return base.replace(/\/?$/, '/') + path.replace(/^\//, '');
}

const ORDERS_KEY = 'jiu_my_orders';

const state = {
  page: 'shop',
  activeCategory: CATEGORIES[0].id,
  detailProductId: null,
  cart: [],
  addCartProductId: null,
  addCartSpec: 'bottle',
  addCartQty: 1,
};

// ── 初始化 ──
function init() {
  renderMain();
  updateCartUI();
  bindEvents();
}

function renderMain() {
  const nav = document.getElementById('categoryNav');
  const backBtn = document.getElementById('backBtn');

  if (state.page === 'shop') {
    nav.style.display = '';
    backBtn.hidden = true;
    renderCategories();
    renderProducts();
  } else {
    nav.style.display = 'none';
    backBtn.hidden = false;
    if (state.page === 'detail') renderProductDetail(state.detailProductId);
    if (state.page === 'orders') renderMyOrders();
  }
}

function formatCatName(cat) {
  if (cat.nameLines) return cat.nameLines.join('<br>');
  return cat.name;
}

function renderCategories() {
  const nav = document.getElementById('categoryNav');
  nav.innerHTML = CATEGORIES.map(
    (cat) => `
    <div class="cat-item ${cat.id === state.activeCategory ? 'active' : ''}"
         data-id="${cat.id}">
      <span class="cat-item-name">${formatCatName(cat)}</span>
      <span class="cat-item-sub">${cat.subtitle}</span>
    </div>`
  ).join('');
}

function renderPriceHint(product) {
  if (product.pricing.type === 'dual') {
    const { bottle, case: c } = product.pricing;
    return `<div class="price-hint">单瓶 <strong>¥${bottle.price}</strong> · 成箱 <strong>¥${c.price}</strong></div>`;
  }
  return `<div class="price-hint"><strong>¥${product.pricing.price}</strong><span>/${product.pricing.unit}</span></div>`;
}

function renderProducts() {
  const area = document.getElementById('productArea');
  const cat = CATEGORIES.find((c) => c.id === state.activeCategory);
  const products = PRODUCTS.filter((p) => p.categoryId === state.activeCategory);

  preloadCategoryImages(products);

  area.innerHTML = `
    <div class="category-header">
      <h2>${cat.name}</h2>
      <p>${cat.subtitle}</p>
    </div>
    ${products.map((p, i) => renderProductCard(p, i)).join('')}
  `;

  bindImageLoaders();
}

function preloadCategoryImages(products) {
  products.forEach((p) => {
    const img = new Image();
    img.src = assetUrl(p.image.replace(/\.jpg$/, '.webp'));
  });
}

function renderProductImage(product, index) {
  const jpg = assetUrl(product.image);
  const webp = assetUrl(product.image.replace(/\.jpg$/, '.webp'));
  const priority = index < 2 ? ' fetchpriority="high"' : '';
  return `
    <picture>
      <source srcset="${webp}" type="image/webp">
      <img class="product-image" src="${jpg}" alt="${product.name}" decoding="async"${priority}>
    </picture>`;
}

function bindImageLoaders(root) {
  (root || document).querySelectorAll('.product-image').forEach((img) => {
    const done = () => {
      img.classList.add('is-loaded');
      img.closest('.product-image-wrap')?.classList.add('is-loaded');
    };
    if (img.complete) done();
    else {
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    }
  });
}

function renderProductCard(product, index) {
  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card-link" data-product="${product.id}">
        <div class="product-image-wrap">
          ${renderProductImage(product, index)}
        </div>
        <div class="product-body">
          <div class="product-name">${product.name}</div>
          <div class="product-desc">${product.desc}</div>
          ${renderPriceHint(product)}
        </div>
      </div>
      <div class="product-actions">
        <button class="add-btn" type="button" data-product="${product.id}">加入购物袋</button>
      </div>
    </div>`;
}

function renderProductDetail(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return goShop();

  const area = document.getElementById('productArea');
  let pricingHtml = '';

  if (product.pricing.type === 'dual') {
    const { bottle, case: c } = product.pricing;
    pricingHtml = `
      <div class="detail-pricing">
        <div class="detail-price-row"><span>单瓶</span><strong>¥${bottle.price}</strong><em>/${bottle.unit}</em></div>
        <div class="detail-price-row"><span>成箱</span><strong>¥${c.price}</strong><em>/${c.unit} · ${c.note}</em></div>
      </div>`;
  } else {
    pricingHtml = `
      <div class="detail-pricing">
        <div class="detail-price-row"><span>售价</span><strong>¥${product.pricing.price}</strong><em>/${product.pricing.unit}</em></div>
      </div>`;
  }

  area.innerHTML = `
    <div class="detail-page">
      <div class="product-image-wrap detail-image-wrap">
        ${renderProductImage(product, 0)}
      </div>
      <div class="detail-content">
        <h2 class="detail-title">${product.name}</h2>
        <p class="detail-subtitle">${product.desc}</p>
        ${pricingHtml}
        <div class="detail-text">${product.detail || product.desc}</div>
        <button class="submit-btn detail-add-btn" type="button" data-product="${product.id}">加入购物袋</button>
      </div>
    </div>`;

  bindImageLoaders(area);
  area.scrollTop = 0;
}

function renderMyOrders() {
  const area = document.getElementById('productArea');
  area.innerHTML = `
    <div class="orders-page">
      <div class="page-header"><h2>我的订单</h2><p id="ordersLoading">同步订单中…</p></div>
      <div id="ordersContainer"></div>
    </div>`;
  area.scrollTop = 0;
  syncAndRenderOrders();
}

async function syncAndRenderOrders() {
  const container = document.getElementById('ordersContainer');
  const loading = document.getElementById('ordersLoading');
  let orders = loadOrdersFromLocal();

  const phones = [...new Set(orders.map((o) => o.customer?.phone).filter(Boolean))];
  try {
    if (phones.length) {
      const remoteLists = await Promise.all(phones.map((p) => fetchOrdersByPhone(p)));
      orders = mergeOrders(orders, remoteLists.flat());
      saveOrdersToLocal(orders);
    }
  } catch {
    /* 离线时仍显示本地订单 */
  }

  if (loading) {
    loading.textContent = orders.length ? `共 ${orders.length} 笔` : '';
  }

  if (!orders.length) {
    container.innerHTML = '<div class="orders-empty">暂无订单记录<br><span>成功下单后，订单将显示在这里</span></div>';
    return;
  }

  container.innerHTML = orders.map(renderOrderCard).join('');
}

function renderOrderCard(order) {
  const date = new Date(order.createdAt).toLocaleString('zh-CN');
  const st = getStatusInfo(order);
  const items = order.items
    .map((i) => `<li>${i.name}（${i.spec}）× ${i.qty} · ¥${i.subtotal}</li>`)
    .join('');

  let statusExtra = '';
  if ((order.status === 'shipped' || order.status === 'completed') && order.trackingNo) {
    statusExtra = `<div class="order-extra">快递单号：<strong>${order.trackingNo}</strong></div>`;
  }
  if (order.status === 'cancelled' && order.cancelReason) {
    statusExtra = `<div class="order-extra cancel-reason">取消原因：${order.cancelReason}</div>`;
  }

  return `
    <div class="order-card">
      <div class="order-card-head">
        <span class="order-id">${order.id}</span>
        <span class="order-status ${st.className}">${st.label}</span>
      </div>
      <div class="order-date">${date}</div>
      <ul class="order-items">${items}</ul>
      <div class="order-meta">
        <span>${order.customer.name} · ${order.customer.phone}</span>
        <strong>¥${order.total}</strong>
      </div>
      <div class="order-address">${formatFullAddress(order.customer)}</div>
      ${statusExtra}
    </div>`;
}

function loadMyOrders() {
  return loadOrdersFromLocal();
}

function saveMyOrder(order) {
  const orders = loadMyOrders();
  orders.unshift(order);
  saveOrdersToLocal(orders);
}

function goShop() {
  state.page = 'shop';
  renderMain();
}

function openDetail(productId) {
  state.page = 'detail';
  state.detailProductId = productId;
  renderMain();
}

function openOrders() {
  state.page = 'orders';
  renderMain();
}

function getProductPrice(product, spec) {
  if (product.pricing.type === 'dual') {
    const opt = product.pricing[spec];
    return { price: opt.price, label: opt.label, unit: opt.unit, note: opt.note || '' };
  }
  return {
    price: product.pricing.price,
    label: '标准',
    unit: product.pricing.unit,
    note: '',
  };
}

function getCartKey(productId, spec) {
  return spec ? `${productId}:${spec}` : productId;
}

function addToCart(productId, qty, spec) {
  const product = PRODUCTS.find((p) => p.id === productId);
  const useSpec = product.pricing.type === 'dual' ? spec : null;
  const key = getCartKey(productId, useSpec);
  const priceInfo = getProductPrice(product, useSpec);

  const existing = state.cart.find((item) => item.key === key);
  if (existing) existing.qty += qty;
  else {
    state.cart.push({
      key,
      productId,
      spec: useSpec,
      name: product.name,
      image: product.image,
      ...priceInfo,
      qty,
    });
  }
  updateCartUI();
  showToast(`已加入：${product.name}${useSpec ? `（${priceInfo.label}）× ${qty}` : ` × ${qty}`}`);
}

function openAddCartModal(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  state.addCartProductId = productId;
  state.addCartSpec = product.pricing.type === 'dual' ? 'bottle' : null;
  state.addCartQty = 1;

  document.getElementById('addCartTitle').textContent = product.name;
  renderAddCartBody(product);
  document.getElementById('addCartModal').classList.add('show');
}

function renderAddCartBody(product) {
  const body = document.getElementById('addCartBody');
  let specHtml = '';

  if (product.pricing.type === 'dual') {
    const { bottle, case: c } = product.pricing;
    specHtml = `
      <div class="add-cart-section">
        <div class="add-cart-label">选择规格</div>
        <div class="price-options">
          <div class="price-option ${state.addCartSpec === 'bottle' ? 'selected' : ''}" data-spec="bottle">
            <div class="price-option-label">${bottle.label}</div>
            <div class="price-option-value">¥${bottle.price}</div>
            <div class="price-option-note">/${bottle.unit}</div>
          </div>
          <div class="price-option ${state.addCartSpec === 'case' ? 'selected' : ''}" data-spec="case">
            <div class="price-option-label">${c.label}</div>
            <div class="price-option-value">¥${c.price}</div>
            <div class="price-option-note">${c.note || ''}</div>
          </div>
        </div>
      </div>`;
  }

  body.innerHTML = `
    ${specHtml}
    <div class="add-cart-section">
      <div class="add-cart-label">数量</div>
      <div class="qty-control qty-control-lg" id="addCartQtyCtrl">
        <button class="qty-btn minus" type="button">−</button>
        <span class="qty-value">${state.addCartQty}</span>
        <button class="qty-btn plus" type="button">+</button>
      </div>
    </div>
    <button class="submit-btn" type="button" id="confirmAddCart">确认加入购物袋</button>`;
}

function closeAddCartModal() {
  document.getElementById('addCartModal').classList.remove('show');
  state.addCartProductId = null;
}

function updateCartUI() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById('cartCount');
  el.textContent = count;
  el.dataset.zero = count === 0 ? 'true' : 'false';

  const container = document.getElementById('cartItems');
  if (state.cart.length === 0) {
    container.innerHTML = '<div class="cart-empty">购物袋暂无商品</div>';
    document.getElementById('cartTotal').textContent = '¥0';
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item) => `
    <div class="cart-item" data-key="${item.key}">
      <img class="cart-item-img" src="${assetUrl(item.image)}" alt="" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-spec">${item.label}${item.note ? ` · ${item.note}` : ''} · ¥${item.price}/${item.unit}</div>
        <div class="cart-item-bottom">
          <span class="cart-item-price">¥${item.price * item.qty}</span>
          <div class="qty-control" data-cart-key="${item.key}">
            <button class="qty-btn minus" type="button">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn plus" type="button">+</button>
          </div>
        </div>
      </div>
    </div>`
    )
    .join('');

  document.getElementById('cartTotal').textContent =
    `¥${state.cart.reduce((s, i) => s + i.price * i.qty, 0)}`;
}

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
      transition: 'opacity 0.3s',
      maxWidth: '85%',
      textAlign: 'center',
      letterSpacing: '0.04em',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

function openCart() {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('cartDrawer').classList.add('open');
}

function closeCart() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('cartDrawer').classList.remove('open');
}

function openCheckout() {
  if (state.cart.length === 0) return;
  closeCart();
  const summary = document.getElementById('orderSummary');
  summary.innerHTML =
    state.cart
      .map((i) => `${i.name}（${i.label}）× ${i.qty} · ¥${i.price * i.qty}`)
      .join('<br>') +
    `<div class="total-line">合计：¥${state.cart.reduce((s, i) => s + i.price * i.qty, 0)}</div>`;
  const form = document.getElementById('orderForm');
  initAddressForm(form);
  document.getElementById('checkoutModal').classList.add('show');
}

async function submitOrder(form) {
  const addrErr = validateAddress(form);
  if (addrErr) throw new Error(addrErr);

  const address = getAddressFromForm(form);
  const order = {
    id: 'ORD' + Date.now(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    statusLabel: '待处理',
    customer: {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      ...address,
      note: form.note.value.trim() || '',
    },
    items: state.cart.map((i) => ({
      name: i.name,
      spec: i.label,
      unit: i.unit,
      price: i.price,
      qty: i.qty,
      subtotal: i.price * i.qty,
    })),
    total: state.cart.reduce((s, i) => s + i.price * i.qty, 0),
  };

  const url = `${getApiBase()}${getApiPath()}`;
  const result = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  const saved = result.order || order;
  saveMyOrder(saved);
  return saved;
}

function bindEvents() {
  document.getElementById('categoryNav').addEventListener('click', (e) => {
    const item = e.target.closest('.cat-item');
    if (!item) return;
    state.activeCategory = item.dataset.id;
    renderCategories();
    renderProducts();
    document.getElementById('productArea').scrollTop = 0;
  });

  document.getElementById('productArea').addEventListener('click', (e) => {
    const link = e.target.closest('.product-card-link');
    if (link) {
      openDetail(link.dataset.product);
      return;
    }

    const addBtn = e.target.closest('.add-btn, .detail-add-btn');
    if (addBtn) {
      e.stopPropagation();
      openAddCartModal(addBtn.dataset.product);
      return;
    }
  });

  document.getElementById('addCartBody').addEventListener('click', (e) => {
    const opt = e.target.closest('.price-option');
    if (opt) {
      state.addCartSpec = opt.dataset.spec;
      const product = PRODUCTS.find((p) => p.id === state.addCartProductId);
      renderAddCartBody(product);
      return;
    }

    const ctrl = e.target.closest('#addCartQtyCtrl');
    if (ctrl && e.target.classList.contains('qty-btn')) {
      if (e.target.classList.contains('plus')) state.addCartQty++;
      else state.addCartQty = Math.max(1, state.addCartQty - 1);
      ctrl.querySelector('.qty-value').textContent = state.addCartQty;
      return;
    }

    if (e.target.id === 'confirmAddCart') {
      addToCart(state.addCartProductId, state.addCartQty, state.addCartSpec);
      closeAddCartModal();
    }
  });

  document.getElementById('backBtn').addEventListener('click', goShop);
  document.getElementById('ordersBtn').addEventListener('click', openOrders);

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('overlay').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  document.getElementById('closeCheckout').addEventListener('click', () => {
    document.getElementById('checkoutModal').classList.remove('show');
  });
  document.getElementById('closeAddCart').addEventListener('click', closeAddCartModal);

  document.getElementById('cartItems').addEventListener('click', (e) => {
    const ctrl = e.target.closest('.qty-control[data-cart-key]');
    if (!ctrl || !e.target.classList.contains('qty-btn')) return;
    const key = ctrl.dataset.cartKey;
    const item = state.cart.find((i) => i.key === key);
    if (!item) return;
    if (e.target.classList.contains('plus')) item.qty++;
    else {
      item.qty = Math.max(0, item.qty - 1);
      if (item.qty === 0) state.cart = state.cart.filter((i) => i.key !== key);
    }
    updateCartUI();
  });

  document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('.submit-btn');
    btn.disabled = true;
    btn.textContent = '提交中…';
    try {
      const order = await submitOrder(form);
      document.getElementById('checkoutModal').classList.remove('show');
      document.getElementById('successMsg').textContent =
        `订单号 ${order.id} 已提交，我们将尽快处理。您可在「订单」中查看进度。`;
      document.getElementById('successModal').classList.add('show');
      state.cart = [];
      updateCartUI();
      form.reset();
    } catch (err) {
      showToast(err.message || '提交失败，请稍后重试');
    } finally {
      btn.disabled = false;
      btn.textContent = '确认订购';
    }
  });

  document.getElementById('successOk').addEventListener('click', () => {
    document.getElementById('successModal').classList.remove('show');
  });
}

init();
