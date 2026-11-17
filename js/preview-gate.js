/* Sitio privado (antes del lanzamiento).
   Mientras LAD_PRIVATE_MODE sea true, quien entra sin pase ve proximamente.html.
   El pase se activa entrando una vez a cualquier página con ?acceso=lad-privado y queda guardado
   en ese navegador. Con ?acceso=salir se borra (para ver lo que ve el público).
   Para publicar el sitio: poner LAD_PRIVATE_MODE = false.
   No es seguridad real (el código está a la vista en este archivo): sirve para que el público
   y los buscadores no vean ni compren nada hasta que esté todo listo. */
(function () {
  var LAD_PRIVATE_MODE = true;
  var CODE = 'lad-privado';
  if (!LAD_PRIVATE_MODE) return;

  var allowed = false;
  try {
    var acceso = new URLSearchParams(window.location.search).get('acceso');
    if (acceso === CODE) localStorage.setItem('lad_acceso', CODE);
    if (acceso === 'salir') localStorage.removeItem('lad_acceso');
    allowed = localStorage.getItem('lad_acceso') === CODE;
  } catch (e) {}

  if (!allowed) {
    document.documentElement.style.visibility = 'hidden';
    window.location.replace('/proximamente.html');
  }
})();
