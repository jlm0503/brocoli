# Fase 3 — Puestos, extraordinarios, alertas a Dirección y devoluciones

Nada de lo capturado se borra. Los puestos que ya tienen las personas se conservan (el Administrador actual pasa a Super Admin).

## 1. Puestos (una persona puede tener varios)
- Puestos nuevos: Super Admin, Administrador, Autorizador, Ingeniero, Compras, Almacén general, Dirección.
- En Usuarios y puestos se marcan varios por persona, y a cada ingeniero se le asignan sus ranchos.
- El menú muestra la suma de pantallas de todos sus puestos. Ingeniero solo ve sus ranchos, sin importes.
- Super Admin: todo, incluidos parámetros y corregir fechas. Administrador: catálogos, receta, adicionales, ubicación de tablas.
- Captura de viajes y evaluaciones (Fase 4) queda solo para Super Admin, con el permiso ya preparado por puesto.

## 2. Solicitud extraordinaria (plaga, gusano, helada, otra)
- Ingeniero: tablas afectadas, condición y descripción, productos y cantidad por ha, días de efecto y fecha máxima de surtido.
- Mínimo 3 fotos tomadas en el momento con la cámara (no galería), cada una con fecha, hora y ubicación.
- Revisión de ubicación: cada foto debe caer dentro del radio de alguna tabla elegida (radio automático según ha, mínimo 100 m; el Administrador puede cambiarlo). Si no cae: "Ubicación no válida" y alerta a Dirección. Tabla sin punto: "Ubicación no verificable".
- Bandeja del Autorizador: ver todo junto (fotos, mapa, resultado de ubicación, costo estimado, historial de la tabla y del ingeniero). Autorizar / Autorizar con cambios / Rechazar con motivo. Aviso en rojo si falta 1 día para la fecha máxima.
- Solo lo autorizado llega a Compras. Queda registro de quién, cuándo y qué cambió. El costo se reparte entre las tablas por hectáreas.
- Seguimiento: al cumplirse los días de efecto, el ingeniero ve "Reportar mejora" (3 fotos con ubicación, Mejoró / Parcial / No mejoró, comentario).

## 3. Alertas a Dirección
- Se generan por fotos fuera de lugar o por reporte de mejora no entregado 3 días después de lo esperado.
- Panel con ingeniero, rancho, tabla, tipo, fotos con mapa y fecha. Se cierra como "Notificada al ingeniero" con comentario obligatorio.
- Reporte mensual por ingeniero y por tipo de alerta.

## 4. Devolución semanal (Almacén general)
- Cada semana registra lo no consumido que se retira: producto, cantidad y foto.
- Lo retirado se resta del costo del lote. Reporte por tabla: receta esperada × ha contra consumo teórico (entregado − retirado).

## Avisos
- Por ahora los avisos se ven dentro de la app (contador en el menú y aviso en la pantalla). La notificación en el celular aunque la app esté cerrada llega con la app móvil de la Fase 7.
- Para validar fotos, las tablas necesitan su punto de ubicación. Las que no lo tienen saldrán como "no verificable" hasta que se capture.

## Caso de prueba
Una solicitud con fotos dentro y fuera del radio, autorización con cambios, llegada a Compras, reparto de costo por ha, alerta a Dirección cerrada con comentario y una devolución restada del costo del lote.

## Detalles técnicos
- Migración aditiva: ampliar el enum de puestos, mapear admin → super_admin conservando admin, tabla de ranchos por ingeniero, actualizar `puede_escribir` por colección nueva (extraordinarios, alertas_direccion, devoluciones).
- Reglas puras en calc.ts (radio, dentro/fuera, reparto por ha, vencimientos de alerta, consumo teórico) con pruebas.
- Fotos en el bucket privado `evidencias`, guardando ruta y metadatos (fecha, lat, lng, precisión).
