window.Pricing = (() => {
  const SHIPPING_FEE = 5;
  const FREE_SHIPPING_MIN = 50;
  const COUPONS = { SAVE10: 0.1 };

  const round2 = (n) => Math.round(n * 100) / 100;

  function quote(items, catalog, coupon = '') {
    const lines = [];
    for (const { id, qty } of items) {
      const product = catalog.find((p) => p.id === id);
      const n = Math.max(0, Math.floor(Number(qty) || 0));
      if (!product || n === 0) continue;
      lines.push({ id, name: product.name, price: product.price, qty: n, lineTotal: round2(product.price * n), product });
    }

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

    let discount = 0;
    let couponStatus = null;
    const code = typeof coupon === 'string' ? coupon.trim().toUpperCase() : '';
    if (code) {
      const rate = Object.prototype.hasOwnProperty.call(COUPONS, code) ? COUPONS[code] : 0;
      if (!rate) {
        couponStatus = 'invalid';
      } else {
        couponStatus = 'applied';
        for (const line of lines) {
          if (line.product.onSale) continue;
          discount += line.lineTotal * rate;
        }
      }
    }
    discount = round2(discount);

    const afterDiscount = round2(subtotal - discount);
    const shipping = lines.length === 0 || afterDiscount >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE;
    const total = round2(afterDiscount + shipping);

    return {
      lines: lines.map(({ product, ...l }) => l),
      subtotal,
      coupon: couponStatus === 'applied' ? code : null,
      couponStatus,
      discount,
      shipping,
      total,
    };
  }

  return { quote, COUPONS, SHIPPING_FEE, FREE_SHIPPING_MIN };
})();
