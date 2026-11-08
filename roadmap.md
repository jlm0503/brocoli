# Roadmap · App control de campo brócoli (Ultra Farms)

Documento vigente: PROMPT COMPLETO (31 oct). Una fase a la vez; se confirma con el usuario al terminar cada una. Nunca borrar datos capturados.

## Fase 1 — Base (cerrada por el usuario, 1 nov)
- [x] Catálogos: ranchos, tablas, productos, cultivos (editable), variedades, viveros, choferes, congeladora única, problemas de calidad
- [x] Parámetros con fecha de vigencia (plantas/ha, costo planta, precio kg, descuento viaje, meta, rollos/ha, días sin evaluación)
- [x] Precios de productos con fecha de vigencia
- [x] Receta -2 a 12 con cinta a 2.1 rollos/ha desde Parámetros; adicionales por tabla; receta fija por lote
- [x] Planeación por lotes con plantas (ha × 60,000, ±10% con motivo), vivero, fecha de entrega de planta
- [x] Arrastre divide plantas proporcionalmente; estatus "En cosecha"
- [x] Pedido de planeación con semáforo, planeación tardía, cancelación con alerta
- [x] Entregar N / Comprar N+2 con rollos redondeados y estatus por renglón
- [ ] Receta de coliflor (la manda el usuario)
- [x] Nombre real de la congeladora: Ultracongelados
- [x] Cinta entregada a las coliflores ya plantadas (y evitar que se pierdan cambios de otros)
- [x] Quitar fresa, frambuesa y zarzamora del paquete tecnológico (dejar maíz, coliflor, brócoli)

## Fase 2 — Solicitud de planta (PDF) y cuenta de planta (cerrada por el usuario)
- [x] Solicitud de planta por lote o consolidada (vivero + semana), folio SP-0001, PDF, compartir, reimprimir
- [x] Estatus Generada / Enviada / Planta recibida (cantidad, fecha, foto, diferencia) / Cancelada; arrastrados no generan
- [x] Cuenta de planta: cargos al recibir planta, abonos por viaje evaluado (llegan en Fase 4), indicadores, gráfica mensual
- [x] Costo real de planta en el costo del lote
- [x] Caso de prueba Fase 2 (300,000 plantas → $81,000; 2 viajes → saldo $61,000, 24.7%)
- [ ] Logo real de Ultra Farms (lo da el usuario) y qué fechas abarca una "temporada"
## Fase 3 — Roles múltiples, extraordinarios, alertas a Dirección, devoluciones (cerrada por el usuario, 3 nov)
- [x] Puestos: Super Admin, Administrador, Autorizador, Ingeniero (solo sus ranchos), Compras, Almacén, Dirección; varios por persona
- [x] Extraordinarios con 3+ fotos de cámara, GPS y validación por radio; autorizar / con cambios / rechazar; aviso rojo a 1 día
- [x] Reporte de mejora; alertas a Dirección (ubicación no válida, mejora no entregada +3 días) y reporte mensual
- [x] Devoluciones semanales con foto; se restan del costo del lote; consumo teórico por tabla
- [ ] Avisos push al celular (pendiente: hoy son avisos dentro de la app)
- [ ] Ubicación GPS de tablas (Fase 7); mientras, las fotos salen "no verificable"
- [x] Prueba completa con datos de prueba (3 nov): "Rancho Prueba", tablas Prueba 1-4, variedad "Prueba", EX-0001 a EX-0005, una devolución; el ingeniero Prueba quedó asignado solo a Rancho Prueba
- [ ] Borrar los datos de prueba cuando Jimena lo pida (por ahora se quedan para pruebas; incluye Chofer Prueba y viaje PRUEBA-V1) (ids prueba-*, rancho prueba-rancho, ex-* de ese rancho, alertas y devolución ligadas)
## Fase 4 — Cosecha (cerrada por el usuario, 5 nov)
- [x] Salida del embarque sin kilos (folio, fecha/hora, chofer, lotes, foto de la hoja); lote cerrado solo Super Admin con motivo
- [x] Evaluación: kg brutos/pagables, calificación, problemas, reporte; reparto por ha o ajuste del Super Admin; merma, bruto, descuento, neto
- [x] Descuento por viaje abona a la Cuenta de planta
- [x] Panel de cosecha con semana, indicadores, semáforo de meta y "Cosecha terminada"; alerta de viaje sin evaluar a 3 días
- [x] Liquidación jueves a miércoles con pago real, comprobante, estatus, Excel y PDF
- [x] Rendimiento y retorno por lote/tabla/rancho/ingeniero, gráfica contra meta, ranking; reporte de calidad
- [x] Caso de prueba Fase 4 en pruebas automáticas
- [ ] Salidas sin señal (va con el modo offline de la Fase 7)
- [ ] Permisos de captura de cosecha editables por puesto (hoy solo Super Admin)
## Fase 5 — Cierre de ciclo, históricos, captura histórica (lista, esperando confirmación)
- [x] Lista de verificación, "Listo para cerrar", forzar cierre con motivo, foto fija, reabrir con motivo y bitácora
- [x] Históricos: filtros, totales ponderados por ha, agrupar, comparar 2-4 ciclos, gráfica por tabla, Excel y PDF
- [x] Captura histórica con viajes rápidos e importación CSV con plantilla; valida fechas encimadas
- [x] Temporada = de la plantación al cierre de cosecha (máx. 2 semanas de cosecha; aviso para cerrar)
- [x] Gastos comunes en la foto fija (llegan en Fase 6; se prorratean de la planeación al cierre)
## Fase 6 — Gastos comunes por rancho y cultivo, utilidad real
- [x] Captura semanal por rancho y cultivo: nómina, diésel, gasolina, mano de obra extra, mantenimiento, otros (con detalle)
- [x] Modo "Total del rancho" repartido entre cultivos con % (generales y ajuste por semana)
- [x] Prorrateo por hectáreas entre lotes activos del mismo cultivo y rancho; lo que no se puede repartir queda "Gasto no asignado"
- [x] Importación desde Excel/CSV con plantilla (reconoce el nombre escrito a mano de rancho, cultivo y concepto)
- [x] Comprobante (foto o PDF) y comentario por gasto; captura solo para Super Admin y Encargado de rancho
- [x] Estado de resultados con utilidad directa y real, por rancho/cultivo, con comparativo, Excel y PDF (solo Super Admin)
- [x] Caso de prueba de la Fase 6 en pruebas automáticas (60/40 y lote cerrado)
- [ ] El encargado de rancho aún no se limita a sus ranchos asignados (hoy ve todos los ranchos para capturar)
## Fase 7 — Ubicación de tablas, offline, integración CSV, app móvil

## Panel de Dirección
- [ ] Conciliar hectáreas activas reportadas (123 ha), separando superficie plantada y por plantar sin cambiar capturas.
- [ ] Agregar cosecha de semana pasada, actual y próxima con kilos, pago/esperado y kg/ha; comprobar con datos reales.
- [x] Unificar plantación semanal, tablas activas, calendario de cosecha, kg/ha, costos, consumos y gastos con gráficas y filtros conjuntos. Verificado con 50 vigentes y 23 históricos, fechas y rancho, en computadora y celular.
- [x] Permitir consulta a Dirección con gastos de solo lectura y mantener utilidad real privada; pruebas de permisos y cálculos pasando.
- [ ] Verificar con cuenta de Dirección: aún no existe ninguna cuenta con ese puesto; pendiente de asignación por Jimena.

## Importación del historial de otro sistema (6 nov)
- [x] Cargar planta por parámetro en los 50 lotes vigentes (16 planeados y 34 plantados; excluir 4 finalizados), sin tocar los 23 históricos: 6,851,100 plantas y $1,849,797. Comprobar cuenta, cero pendientes de solicitud y regla de abonos de viajes.
- [x] Retirar las siete tablas agrupadas de Dolores y Vergel sin modificar históricos ni plantaciones; verificar disponibilidad y conservación.
- [x] Cargar la plantilla completada del 8 nov: 195 viajes en 23 históricos, 2,183,440 kg recibidos, 1,689,123 kg pagables y $1,950,000 en descuentos de planta; eliminar solo T13 (Santa Mónica, Altamira, tabla 4), conservar los demás consumos y dejar gastos/fin de cosecha pendientes de confirmar. Verificado al recargar en la cuenta de Jimena.
- [x] Entregar plantilla con la lista actual de tablas históricas y captura de viajes uno por uno (7 nov).
- [x] Importar historio_Brocoli_cerrado.xlsx: 24 históricos, 25 folios, 745 renglones, 155.17 ha y $5,480,112.56; conservar Trejo y sus 17 tablas actuales.
- [x] Santa Mónica 8A/8B unificadas en 5.6 ha, sumando consumos y conservando ambos folios; fecha cosecha del archivo es inicio, no cierre.
- [x] Completar manualmente cosecha, ingreso y gastos históricos, guardar avances y cerrar al terminar; no genera pedidos ni estima costos faltantes.
- [x] Verificar importación en datos y captura manual con cuenta de Jimena: guardar/recargar kilos y nómina, retirar solo los datos de prueba; revisar consumos y celular.

Notas Fase 4: sin alerta de merma; la única alerta de rendimiento es cuando un lote cierra con menos kg/ha que la meta (16,000).
