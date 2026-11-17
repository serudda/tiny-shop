// Tiny Shop storefront. Prices come from pricing.js, products from products.js.

const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const state = {
  cart: storage.get('cart', []),
  coupon: storage.get('coupon', ''),
  couponError: '',
  order: null,
};

function save() {
  storage.set('cart', state.cart);
  storage.set('coupon', state.coupon);
}

function currentQuote() {
  return Pricing.quote(state.cart, CATALOG, state.coupon);
}

// ----- helpers -----

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toFixed(2)}`;

// ----- product list -----

function renderProducts() {
  $('products').innerHTML = CATALOG.map((p) => `
    <article class="card" data-testid="product-${p.id}">
      <div class="art">${ART[p.id] || ''}</div>
      <h3>${p.name}</h3>
      <div class="price">
        <span>${money(p.price)}</span>
        ${p.onSale ? '<span class="tag">Sale</span>' : ''}
      </div>
      <button type="button" data-add="${p.id}">Add to cart</button>
    </article>`).join('');
}

function render() {
  renderCart();
}

// ----- cart -----

function addToCart(id) {
  state.order = null;
  const line = state.cart.find((l) => l.id === id);
  if (line) line.qty += 1;
  else state.cart.push({ id, qty: 1 });
  save();
  render();
}

function setQty(id, qty) {
  state.cart = qty <= 0
    ? state.cart.filter((l) => l.id !== id)
    : state.cart.map((l) => (l.id === id ? { ...l, qty } : l));
  save();
  render();
}

function renderCart() {
  const count = state.cart.reduce((n, l) => n + l.qty, 0);
  $('cart-count').textContent = `Cart (${count})`;

  if (state.order) {
    $('cart-body').innerHTML = `
      <div class="confirmation" data-testid="confirmation">
        <strong>Order ${state.order.id} is confirmed.</strong>
        <span>Total charged: <span data-testid="charged">${money(state.order.total)}</span></span>
        <button type="button" class="secondary" id="continue-shopping">Continue shopping</button>
      </div>`;
    return;
  }

  const q = currentQuote();
  if (q.lines.length === 0) {
    $('cart-body').innerHTML = '<p class="empty">Your cart is empty.</p>';
    return;
  }

  $('cart-body').innerHTML = `
    ${q.lines.map((l) => `
      <div class="line" data-testid="line-${l.id}">
        <span class="line-name">${l.name}</span>
        <span class="line-total">${money(l.lineTotal)}</span>
        <span class="qty">
          <button type="button" class="secondary" data-qty="${l.id}" data-delta="-1" aria-label="Decrease ${l.name}">−</button>
          <span>Qty ${l.qty}</span>
          <button type="button" class="secondary" data-qty="${l.id}" data-delta="1" aria-label="Increase ${l.name}">+</button>
        </span>
        <button type="button" class="link" data-remove="${l.id}">Remove</button>
      </div>`).join('')}

    <form class="coupon" id="coupon-form">
      <label class="sr-only" for="coupon-input">Coupon code</label>
      <input id="coupon-input" name="coupon" placeholder="Coupon code" autocomplete="off" value="${escapeAttr(state.couponError ? state.couponError.typed : (q.coupon || ''))}">
      <button type="submit" class="secondary">Apply</button>
    </form>
    <p class="coupon-msg ${state.couponError ? 'error' : 'ok'}" data-testid="coupon-msg">${
      state.couponError
        ? `Invalid code${q.coupon ? ` (${q.coupon} is still applied)` : ''}`
        : q.coupon ? `${q.coupon} applied. <button type="button" class="link" id="remove-coupon">Remove</button>` : ''
    }</p>

    <table class="totals">
      <tr><td>Subtotal</td><td data-testid="subtotal">${money(q.subtotal)}</td></tr>
      ${q.coupon ? `<tr><td>Coupon (${q.coupon})</td><td data-testid="discount">−${money(q.discount)}</td></tr>` : ''}
      <tr><td>Shipping</td><td data-testid="shipping">${q.shipping === 0 ? 'Free' : money(q.shipping)}</td></tr>
      <tr class="total"><td>Total</td><td data-testid="total">${money(q.total)}</td></tr>
    </table>

    <button type="button" class="checkout" id="checkout">Checkout</button>`;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyCoupon(typed) {
  const code = String(typed || '').trim();
  if (!code) return;
  const check = Pricing.quote(state.cart, CATALOG, code);
  if (check.couponStatus === 'invalid') {
    state.couponError = { typed: code };
  } else {
    state.coupon = check.coupon;
    state.couponError = '';
    save();
  }
  render();
}

function removeCoupon() {
  state.coupon = '';
  state.couponError = '';
  save();
  render();
}

function checkout() {
  const q = currentQuote();
  if (q.lines.length === 0) return;
  const n = storage.get('orderCount', 0) + 1;
  storage.set('orderCount', n);
  state.order = { id: `TS-${1000 + n}`, total: q.total };
  state.cart = [];
  state.coupon = '';
  state.couponError = '';
  save();
  render();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.add) addToCart(t.dataset.add);
  else if (t.dataset.qty) {
    const line = state.cart.find((l) => l.id === t.dataset.qty);
    setQty(t.dataset.qty, (line ? line.qty : 0) + Number(t.dataset.delta));
  } else if (t.dataset.remove) setQty(t.dataset.remove, 0);
  else if (t.id === 'checkout') checkout();
  else if (t.id === 'remove-coupon') removeCoupon();
  else if (t.id === 'continue-shopping') { state.order = null; render(); }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'coupon-form') return;
  e.preventDefault();
  applyCoupon(new FormData(e.target).get('coupon'));
});

renderProducts();
render();
