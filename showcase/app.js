/** 品鉴江南文化展示站 — 交互逻辑 */

const state = {
  view: 'region',
  activeId: REGIONS[0].id,
};

function getFilters() {
  return state.view === 'category' ? CATEGORIES : REGIONS;
}

function getActiveMeta() {
  return getFilters().find((item) => item.id === state.activeId) || getFilters()[0];
}

function giftMatches(gift) {
  const key = state.view === 'category' ? 'categories' : 'regions';
  return gift[key].includes(state.activeId);
}

function countGiftsForFilter(id, view) {
  const key = view === 'category' ? 'categories' : 'regions';
  return GIFTS.filter((g) => g[key].includes(id)).length;
}

function getRegionName(id) {
  return REGIONS.find((r) => r.id === id)?.name || id;
}

function getCategoryName(id) {
  return CATEGORIES.find((c) => c.id === id)?.name || id;
}

function renderTags(gift) {
  const regions = gift.regions.map((id) => `<span class="tag tag-region">${getRegionName(id)}</span>`).join('');
  const cats = gift.categories.map((id) => `<span class="tag tag-cat">${getCategoryName(id)}</span>`).join('');
  return regions + cats;
}

function renderRegionIntro(meta) {
  const box = document.getElementById('regionIntro');
  if (!box) return;
  if (state.view !== 'region' || !meta.intro) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = `
    <div class="region-intro-inner">
      <span class="region-intro-tag">${meta.tag}</span>
      <p>${meta.intro}</p>
    </div>`;
}

function renderGifts() {
  const meta = getActiveMeta();
  const list = GIFTS.filter(giftMatches);
  const title = document.getElementById('sectionTitle');
  const desc = document.getElementById('sectionDesc');
  const grid = document.getElementById('giftGrid');
  const count = document.getElementById('giftCount');

  title.textContent = meta.name;
  desc.textContent = meta.desc;
  count.textContent = list.length ? `共 ${list.length} 项推荐` : '';

  renderRegionIntro(meta);

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">暂无相关内容</div>';
    return;
  }

  grid.innerHTML = list
    .map(
      (gift) => `
    <article class="gift-card">
      <div class="gift-card-top">
        <div class="gift-card-head">
          <h3>${gift.name}</h3>
          ${gift.subtitle ? `<p class="gift-subtitle">${gift.subtitle}</p>` : ''}
        </div>
        ${gift.season ? `<span class="gift-season">${gift.season}</span>` : ''}
      </div>
      <div class="gift-tags">${renderTags(gift)}</div>
      <p class="gift-intro">${gift.intro}</p>
      ${gift.heritage ? `<p class="gift-heritage"><strong>文化背景</strong>${gift.heritage}</p>` : ''}
      <p class="gift-tips"><strong>选购提示</strong>${gift.tips}</p>
      ${
        gift.shops?.length
          ? `<div class="gift-shops"><span>推荐店铺</span><ul>${gift.shops.map((s) => `<li>${s}</li>`).join('')}</ul></div>`
          : ''
      }
    </article>`
    )
    .join('');
}

function renderFilters() {
  const nav = document.getElementById('filterNav');
  nav.innerHTML = getFilters()
    .map((item) => {
      const n = countGiftsForFilter(item.id, state.view);
      return `
    <button type="button" class="filter-chip ${item.id === state.activeId ? 'active' : ''}" data-id="${item.id}">
      ${state.view === 'category' ? `<em>${item.icon}</em>` : `<em class="chip-count">${n}</em>`}
      <span>${item.name}</span>
    </button>`;
    })
    .join('');
}

function renderShops() {
  const list = document.getElementById('shopList');
  list.innerHTML = FEATURED_SHOPS.map(
    (shop) => `
    <article class="shop-card">
      <div class="shop-card-head">
        <h3>${shop.name}</h3>
        <span class="shop-city">${shop.city}</span>
      </div>
      <p class="shop-specialty">${shop.specialty}</p>
      <p class="shop-note">${shop.note}</p>
    </article>`
  ).join('');
}

function updateViewTabs() {
  document.querySelectorAll('.view-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
}

function switchView(view) {
  if (state.view === view) return;
  state.view = view;
  state.activeId = getFilters()[0].id;
  updateViewTabs();
  renderFilters();
  renderGifts();
}

function bindEvents() {
  document.getElementById('viewTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.view-tab');
    if (!tab) return;
    switchView(tab.dataset.view);
  });

  document.getElementById('filterNav').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    state.activeId = chip.dataset.id;
    renderFilters();
    renderGifts();
    document.getElementById('giftGrid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function init() {
  renderFilters();
  renderGifts();
  renderShops();
  updateViewTabs();
  bindEvents();
}

init();
