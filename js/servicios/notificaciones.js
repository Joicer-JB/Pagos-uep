// Avisos internos por correo (EmailJS) cuando se registran estudiantes, finanzas, nómina o notas.

function enviarNotificacion(asunto, mensaje){
  emailjs.init(EJS_KEY);
  emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
    subject: asunto,
    message: mensaje
  }).then(()=>{
    console.log("✅ Notificación enviada:", asunto);
  }).catch(err=>{
    console.warn("⚠️ Error notificación:", err);
  });
}
function alertaEstudiante(est, accion){
  const asunto = accion + " Estudiante: " + est.nombre;
  const msg = "🏫 " + EMPRESA + "\n🔔 ALERTA DEL SISTEMA\n\n"
    + "👨‍🎓 " + accion + " Estudiante\n"
    + "📛 Nombre: " + est.nombre + "\n"
    + "🪪 Cédula: " + (est.cedula||"N/A") + "\n"
    + "📚 Grado: " + (est.grado||"N/A") + "\n"
    + "📅 Año Escolar: " + (est.anioEscolar||"N/A") + "\n"
    + "👤 Acudiente: " + (est.acudiente||"N/A") + "\n"
    + "📞 Teléfono: " + (est.telefono||"N/A") + "\n"
    + "⚡ Estado: " + (est.estado==="mora"?"⚠️ En Mora":est.estado==="retirado"?"🚪 Retirado":"✅ Al Saldo") + "\n"
    + "\n🕐 " + new Date().toLocaleString("es-CO");
  enviarNotificacion(asunto, msg);
}
function alertaFinanza(f){
  const tipo = f.tipo==="ingreso" ? "📈 Nuevo Ingreso" : "📉 Nuevo Gasto";
  const asunto = tipo + ": " + f.descripcion + " - " + fmt(f.monto);
  const msg = "🏫 " + EMPRESA + "\n🔔 ALERTA DEL SISTEMA\n\n"
    + tipo + "\n"
    + "📋 Descripción: " + f.descripcion + "\n"
    + "🏷️ Categoría: " + (f.categoria||"N/A") + "\n"
    + "💰 Monto: " + fmt(f.monto) + "\n"
    + "📅 Fecha: " + f.fecha + "\n"
    + "👤 Responsable: " + (f.responsable||"N/A") + "\n"
    + "\n🕐 " + new Date().toLocaleString("es-CO");
  enviarNotificacion(asunto, msg);
}
function alertaNomina(t, accion){
  const total = (t.salario||0)+(t.bonoAlimentacion||0)+(t.bonoProductividad||0)-(t.descuento||0);
  const asunto = accion + " Nómina: " + t.nombre;
  const msg = "🏫 " + EMPRESA + "\n🔔 ALERTA DEL SISTEMA\n\n"
    + "👷 " + accion + " en Nómina\n"
    + "📛 Nombre: " + t.nombre + "\n"
    + "💼 Cargo: " + (t.cargo||"N/A") + "\n"
    + "💵 Salario base: " + fmt(t.salario||0) + "\n"
    + "🍽️ Bono alimentación: " + fmt(t.bonoAlimentacion||0) + "\n"
    + "⭐ Bono productividad: " + fmt(t.bonoProductividad||0) + "\n"
    + "➖ Descuento: " + fmt(t.descuento||0) + "\n"
    + "✅ Total: " + fmt(total) + "\n"
    + "\n🕐 " + new Date().toLocaleString("es-CO");
  enviarNotificacion(asunto, msg);
}
function alertaNotas(est, lapso){
  const asunto = "📝 Notas actualizadas: " + est.nombre + " - " + lapso;
  const msg = "🏫 " + EMPRESA + "\n🔔 ALERTA DEL SISTEMA\n\n"
    + "📝 Notas Actualizadas\n"
    + "👨‍🎓 Estudiante: " + est.nombre + "\n"
    + "📚 Grado: " + (est.grado||"N/A") + "\n"
    + "📅 Lapso: " + lapso + "\n"
    + "\n🕐 " + new Date().toLocaleString("es-CO");
  enviarNotificacion(asunto, msg);
}
function alertaPagoNomina(desc, monto, trab){
  const asunto = "💳 Pago Nómina: " + desc;
  const msg = "🏫 " + EMPRESA + "\n🔔 ALERTA DEL SISTEMA\n\n"
    + "💳 Pago de Nómina Registrado\n"
    + "📋 Descripción: " + desc + "\n"
    + "👤 Trabajador: " + trab + "\n"
    + "💰 Monto: " + fmt(monto) + "\n"
    + "\n🕐 " + new Date().toLocaleString("es-CO");
  enviarNotificacion(asunto, msg);
}
