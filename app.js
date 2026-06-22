/** 江南大学伴手礼订购 — 前端逻辑 */

function assetUrl(path) {
  if (!path || path.startsWith('http')) return path;
  const base = window.__BASE__ || '/';
  return base.replace(/\/?$/, '/') + path.replace(/^\//, '');
}

const state = {
  activeCategory: CATEGORIES[0].id,
  cart: [],
  /** 各商品当前选中的规格：{ productId: 'bottle' | 'case' } */
  selectedSpec: {},
};

// ── 初始化 ──
function init() {
  PRODUCTS.forEach((p) => {
    if (p.pricing.type === 'dual') {
      state.selectedSpec[p.id] = 'bottle';
    }
  });
  renderCategories();
  renderProducts();
  bindEvents();
}

function renderCategories() {
  const nav = document.getElementById('categoryNav');
  nav.innerHTML = CATEGORIES.map(
    (cat) => `
    <div class="cat-item ${cat.id === state.activeCategory ? 'active' : ''}"
         data-id="${cat.id}">
      <span class="cat-item-name">${cat.name}</span>
      <span class="cat-item-sub">${cat.subtitle}</span>
    </div>`
  ).join('');
}

function renderProducts() {
  const area = document.getElementById('productArea');
  const cat = CATEGORIES.find((c) => c.id === state.activeCategory);
  const products = PRODUCTS.filter((p) => p.categoryId === state.activeCategory);

  area.innerHTML = `
    <div class="category-header">
      <h2>${cat.name}</h2>
      <p>${cat.subtitle}</p>
    </div>
    ${products.map(renderProductCard).join('')}
  `;
}

function renderProductCard(product) {
  const spec = state.selectedSpec[product.id];
  let pricingHtml = '';

  if (product.pricing.type === 'dual') {
    const { bottle, case: caseOpt } = product.pricing;
    pricingHtml = `
      <div class="pricing-section">
        <div class="pricing-label">选择规格</div>
        <div class="price-options">
          <div class="price-option ${spec === 'bottle' ? 'selected' : ''}"
               data-product="${product.id}" data-spec="bottle">
            <div class="price-option-label">${bottle.label}</div>
            <div class="price-option-value">¥${bottle.price}</div>
            <div class="price-option-note">/${bottle.unit}</div>
          </div>
          <div class="price-option ${spec === 'case' ? 'selected' : ''}"
               data-product="${product.id}" data-spec="case">
            <div class="price-option-label">${caseOpt.label}</div>
            <div class="price-option-value">¥${caseOpt.price}</div>
            <div class="price-option-note">${caseOpt.note || ''}</div>
          </div>
        </div>
      </div>`;
  } else {
    pricingHtml = `
      <div class="pricing-section">
        <div class="single-price">
          <span class="amount">¥${product.pricing.price}</span>
          <span class="unit">/${product.pricing.unit}</span>
        </div>
      </div>`;
  }

  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image-wrap">
        <img class="product-image" src="${assetUrl(product.image)}" alt="${product.name}" loading="lazy" />
      </div>
      <div class="product-body">
        <div class="product-name">${product.name}</div>
        <div class="product-desc">${product.desc}</div>
        ${pricingHtml}
        <div class="product-actions">
          <div class="qty-control" data-product="${product.id}">
            <button class="qty-btn minus" type="button">−</button>
            <span class="qty-value">1</span>
            <button class="qty-btn plus" type="button">+</button>
          </div>
          <button class="add-btn" data-product="${product.id}">加入购物袋</button>
        </div>
      </div>
    </div>`;
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

function addToCart(productId, qty) {
  const product = PRODUCTS.find((p) => p.id === productId);
  const spec = product.pricing.type === 'dual' ? state.selectedSpec[productId] : null;
  const key = getCartKey(productId, spec);
  const priceInfo = getProductPrice(product, spec);

  const existing = state.cart.find((item) => item.key === key);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({
      key,
      productId,
      spec,
      name: product.name,
      image: product.image,
      ...priceInfo,
      qty,
    });
  }
  updateCartUI();
  showToast(`已加入：${product.name}${spec ? `（${priceInfo.label}）` : ''}`);
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

  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cartTotal').textContent = `¥${total}`;
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
      background: 'rgba(0,0,0,0.75)',
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '13px',
      zIndex: '999',
      transition: 'opacity 0.3s',
      maxWidth: '80%',
      textAlign: 'center',
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
  const lines = state.cart.map(
    (i) => `${i.name}（${i.label}）× ${i.qty} · ¥${i.price * i.qty}`
  );
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  summary.innerHTML = lines.join('<br>') + `<div class="total-line">合计：¥${total}</div>`;

  document.getElementById('checkoutModal').classList.add('show');
}

async function submitOrder(formData) {
  const order = {
    id: 'ORD' + Date.now(),
    createdAt: new Date().toISOString(),
    customer: {
      name: formData.get('name'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      note: formData.get('note') || '',
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

  const apiBase = getApiBase();
  const resp = await fetch(`${apiBase}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  const result = await resp.json();
  if (!resp.ok || !result.ok) {
    throw new Error(result.error || '提交失败，请稍后重试');
  }

  return order;
}

function getApiBase() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '';
  }
  const base = window.APP_CONFIG?.API_BASE || '';
  if (!base || base === 'YOUR_VERCEL_URL') {
    throw new Error('请先配置 config.js 中的 Vercel API 地址');
  }
  return base.replace(/\/$/, '');
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
    const opt = e.target.closest('.price-option');
    if (opt) {
      state.selectedSpec[opt.dataset.product] = opt.dataset.spec;
      renderProducts();
      return;
    }

    const addBtn = e.target.closest('.add-btn');
    if (addBtn) {
      const card = addBtn.closest('.product-card');
      const qty = parseInt(card.querySelector('.qty-value').textContent, 10);
      addToCart(addBtn.dataset.product, qty);
      return;
    }

    const qtyCtrl = e.target.closest('.qty-control:not([data-cart-key])');
    if (qtyCtrl && e.target.classList.contains('qty-btn')) {
      const val = qtyCtrl.querySelector('.qty-value');
      let n = parseInt(val.textContent, 10);
      n = e.target.classList.contains('plus') ? n + 1 : Math.max(1, n - 1);
      val.textContent = n;
    }
  });

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('overlay').addEventListener('click', closeCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
  document.getElementById('closeCheckout').addEventListener('click', () => {
    document.getElementById('checkoutModal').classList.remove('show');
  });

  document.getElementById('cartItems').addEventListener('click', (e) => {
    const ctrl = e.target.closest('.qty-control[data-cart-key]');
    if (!ctrl || !e.target.classList.contains('qty-btn')) return;
    const key = ctrl.dataset.cartKey;
    const item = state.cart.find((i) => i.key === key);
    if (!item) return;
    if (e.target.classList.contains('plus')) {
      item.qty++;
    } else {
      item.qty = Math.max(0, item.qty - 1);
      if (item.qty === 0) state.cart = state.cart.filter((i) => i.key !== key);
    }
    updateCartUI();
  });

  document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.submit-btn');
    btn.disabled = true;
    btn.textContent = '提交中…';

    try {
      const order = await submitOrder(new FormData(e.target));

      document.getElementById('checkoutModal').classList.remove('show');
      document.getElementById('successMsg').textContent =
        `订单号 ${order.id} 已提交，我们将尽快与您联系确认配送。`;
      document.getElementById('successModal').classList.add('show');

      state.cart = [];
      updateCartUI();
      e.target.reset();
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
