/* Carrito de compras — persistido en localStorage (mock, sin backend) */
const LAD_CART_KEY = 'lad_cart';

function ladGetCart() {
  try {
    return JSON.parse(localStorage.getItem(LAD_CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function ladSaveCart(cart) {
  localStorage.setItem(LAD_CART_KEY, JSON.stringify(cart));
  ladUpdateCartBadge();
}

function ladAddToCart(productId, qty = 1) {
  const cart = ladGetCart();
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty += qty;
  } else {
    cart.push({ id: productId, qty });
  }
  ladSaveCart(cart);
}

function ladUpdateQty(productId, qty) {
  let cart = ladGetCart();
  if (qty <= 0) {
    cart = cart.filter(i => i.id !== productId);
  } else {
    const item = cart.find(i => i.id === productId);
    if (item) item.qty = qty;
  }
  ladSaveCart(cart);
}

function ladRemoveFromCart(productId) {
  ladUpdateQty(productId, 0);
}

function ladCartCount() {
  return ladGetCart().reduce((sum, i) => sum + i.qty, 0);
}

async function ladCartTotal() {
  const cart = ladGetCart();
  if (cart.length === 0) return 0;
  const products = await Promise.all(cart.map(i => ladGetProductById(i.id)));
  return cart.reduce((sum, item, idx) => {
    const p = products[idx];
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function ladUpdateCartBadge() {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = ladCartCount();
  });
}

document.addEventListener('DOMContentLoaded', ladUpdateCartBadge);
