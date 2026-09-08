/* Header y footer compartidos — inyectados por JS para no depender de un servidor */

const LAD_ICONS = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2Z"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M1 7h13v9H1zM14 10h4l4 3v3h-8z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H8v3h2v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1Z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 2a8 8 0 0 1 6.6 12.5.9.9 0 0 0-.1.9l.8 2.4-2.5-.7a.9.9 0 0 0-.8.1A8 8 0 1 1 12 4Zm-3 3.7c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.2 5 4.3.7.3 1.2.4 1.7.3.6-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3l-.4-.3c-.3-.1-1.7-.9-2-1s-.5-.1-.6.1-.6.8-.8 1c-.1.1-.3.2-.5.1a6.4 6.4 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.6c-.1-.2 0-.4.1-.5l.4-.5.3-.4c.1-.2 0-.3 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4Z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`
};

const NAV_LINKS = [
  { href: 'servicios.html', label: 'Servicios', key: 'servicios' },
  { href: 'tienda.html', label: 'Productos', key: 'tienda' },
  { href: 'nosotros.html', label: 'Nosotros', key: 'nosotros' },
  { href: '#footer-contacto', label: 'Contacto', key: 'contacto' },
  { href: 'faq.html', label: 'FAQs', key: 'faqs' }
];

function ladNavHTML(extraClass) {
  return NAV_LINKS.map(l => `<a href="${l.href}" data-nav="${l.key}" class="${extraClass || ''}">${l.label}</a>`).join('');
}

function ladHeaderHTML() {
  return `
  <div class="topbar">
    <div class="container">
      <div class="topbar-contact">
        <span>${LAD_ICONS.phone} Agregar número (WhatsApp)</span>
      </div>
      <div class="topbar-contact">
        <span>${LAD_ICONS.truck} Envíos a todo el país</span>
      </div>
    </div>
  </div>
  <header class="site-header">
    <div class="container">
      <a href="index.html" class="brand"><img src="assets/img/logo-light.svg" alt="Lad Flooring"></a>
      <nav class="main-nav">${ladNavHTML()}</nav>
      <div class="header-actions">
        <a href="cotizacion.html" class="btn btn-primary btn-sm">Cotizar</a>
        <a href="login.html" class="icon-btn" id="accountLink" title="Mi cuenta">${LAD_ICONS.user}</a>
        <a href="carrito.html" class="icon-btn" id="cartLink" title="Carrito">${LAD_ICONS.cart}<span class="cart-count">0</span></a>
        <button class="nav-toggle icon-btn" id="navToggle" aria-label="Abrir menú">${LAD_ICONS.menu}</button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav">${ladNavHTML()}</nav>
  </header>`;
}

function ladFooterHTML() {
  return `
  <footer class="site-footer" id="footer-contacto">
    <div class="container">
      <div class="footer-grid">
        <div>
          <img src="assets/img/logo-light.svg" alt="Lad Flooring" style="height:44px;margin-bottom:16px;">
          <p style="color:var(--powder-blue);font-size:0.9rem;">Soluciones profesionales para tus pisos de madera.</p>
          <div class="footer-social">
            <a href="https://www.instagram.com/lad.flooring?utm_source=ig_web_button_share_sheet&igsi=ZDNlZDc0MzIxNw==" aria-label="Instagram">${LAD_ICONS.instagram}</a>
          </div>
        </div>
        <div>
          <h4>Links de interés</h4>
          <a href="servicios.html">Servicios</a>
          <a href="tienda.html">Tienda online</a>
          <a href="nosotros.html">Quiénes somos</a>
          <a href="envio.html">Seguimiento de envío</a>
          <a href="faq.html" target="_blank" rel="noopener">Preguntas Frecuentes</a>
        </div>
        <div>
          <h4>Contacto</h4>
          <a href="mailto:info@ladflooring.com">info@ladflooring.com</a>
          <a href="#">${LAD_ICONS.phone} Agregar número (WhatsApp)</a>
          <a href="#">Lun a Vie de 9 a 18 hs</a>
        </div>
        <div>
          <h4>Suscribite</h4>
          <p style="font-size:0.85rem;">Recibí novedades, promociones y tips de mantenimiento.</p>
          <form class="newsletter-form" onsubmit="event.preventDefault(); this.reset(); alert('¡Gracias por suscribirte!');">
            <input type="email" placeholder="Tu email" required>
            <button class="btn btn-primary btn-sm" type="submit">Enviar</button>
          </form>
        </div>
      </div>
    </div>
    <div class="footer-bottom">© 2026 Lad Flooring — Todos los derechos reservados</div>
  </footer>`;
}

async function ladRenderLayout() {
  const headerMount = document.getElementById('lad-header');
  const footerMount = document.getElementById('lad-footer');
  if (headerMount) headerMount.outerHTML = ladHeaderHTML();
  if (footerMount) footerMount.outerHTML = ladFooterHTML();

  const page = document.body.dataset.page;
  if (page) {
    document.querySelectorAll(`[data-nav="${page}"]`).forEach(a => a.classList.add('active'));
  }

  const accountLink = document.getElementById('accountLink');
  if (accountLink && typeof ladIsLoggedIn === 'function' && await ladIsLoggedIn()) {
    const session = typeof ladGetSession === 'function' ? await ladGetSession() : null;
    accountLink.href = (session && session.role === 'admin') ? 'admin.html' : 'usuario.html';

    if (session && session.role === 'admin') {
      const cartLink = document.getElementById('cartLink');
      if (cartLink) {
        cartLink.outerHTML = `<button type="button" class="icon-btn" id="logoutBtn" title="Cerrar sesión">${LAD_ICONS.logout}</button>`;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          if (confirm('¿Estás seguro de que querés cerrar sesión?')) {
            await ladLogout();
            window.location.href = 'login.html';
          }
        });
      }
    }
  }

  const toggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => mobileNav.classList.toggle('open'));
  }

  if (typeof ladUpdateCartBadge === 'function') ladUpdateCartBadge();
}

/* Fotos de producto/servicio: "img" puede ser un placeholder de color (ph-1..ph-5)
   o la URL real de una foto subida a Supabase Storage. ladImgClass/ladImgStyle
   deciden cuál de las dos mostrar sin que cada pantalla tenga que repetir la lógica. */
function ladIsImageUrl(img) {
  return !!img && !img.startsWith('ph-');
}
function ladImgClass(img) {
  return ladIsImageUrl(img) ? '' : (img || 'ph-1');
}
function ladImgBg(img) {
  return ladIsImageUrl(img) ? `background-image:url('${img.replace(/'/g, "%27")}');` : '';
}

document.addEventListener('DOMContentLoaded', ladRenderLayout);
