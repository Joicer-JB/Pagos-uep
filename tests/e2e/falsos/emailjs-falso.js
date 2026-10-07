// EmailJS falso: no envía correos, solo los anota en window.__CORREOS__.
window.__CORREOS__ = [];
window.emailjs = {
  init() {},
  send(servicio, plantilla, datos) {
    window.__CORREOS__.push({ servicio, plantilla, datos });
    return Promise.resolve({ status: 200, text: "OK" });
  },
};
