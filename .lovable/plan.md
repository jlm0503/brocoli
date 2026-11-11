# Permisos por puesto

## Correspondencia de pantallas y colecciones

Las colecciones son los grupos de registros que ya utiliza la aplicación. Una pantalla puede consultar varios grupos sin tener permiso para modificarlos.

| Pantalla | Colecciones principales | Qué se guarda desde esa pantalla |
|---|---|---|
| Aplicaciones en rancho | `aplicaciones_campo`, `continuaciones_aplicacion`, `devoluciones` | Avances, decisión de continuar y devolución de sobrantes. Encargado solo registra avances. |
| Planeación y avance | `lotes`, `pedidos`, `solicitudes`, `tardias`, `alertas` | Planeación, avances de plantación, pedidos/solicitudes derivados y alertas al cancelar. |
| Solicitudes de planta | `solicitudes`, `lotes` | Solicitud, envío, cancelación y datos de planta/vivero del lote. Las recepciones se capturarán en Llegadas. |
| Lo que llega al rancho | `recepciones`, `pedidos`, `solicitudes` | Recepciones de receta, preparación y planta, con cantidades y evidencia. Actualmente esta pantalla solo consulta; se incorporarán sus controles de recepción. |
| Extraordinarios | `extraordinarios` | Solicitud del Ingeniero; autorización/rechazo del Autorizador y surtido de Compras conservan su flujo. |
| Cosecha | `viajes`, `lotes` | Salidas; evaluación solo Super Admin. El cierre/terminación no se habilitará por el permiso de registrar salidas. |
| Rendimiento y calidad | `viajes`, `lotes`, `ciclos`, `asignaciones` | Solo consulta; utiliza también las fuentes compartidas de costos. |
| Compras y entregas | `pedidos`, `recepciones`, `extraordinarios` | Compra y surtido; los registros de recepción se comparten con Llegadas y requieren restricciones por acción. |
| Devoluciones | `devoluciones` | Devoluciones con evidencia. |
| Alertas y reportes | `alertas`, `tardias`, `inventario` | Consulta para Administrador y Almacén; resolver/reubicar/recolectar queda solo para Super Admin. |
| Gastos de rancho | `gastos`, `repartos` | Gastos y distribución entre cultivos. |
| Estatus y costos | `ranchos`, `tablas`, `lotes` y fuentes compartidas de costos | Consulta; correcciones existentes solo Super Admin. |
| Consumo por tabla | `lotes`, `recetas`, `adicionales`, `recepciones`, `pedidos`, `extraordinarios`, `devoluciones` | Solo consulta. |
| Liquidación semanal | `liquidaciones`, `viajes` | Pagos solo Super Admin; Administrativo consulta. |
| Cuenta de planta | `solicitudes`, `viajes`, `parametros`, `lotes` | Solo consulta de cargos y descuentos. |
| Estado de resultados | `gastos`, `repartos`, `lotes`, `viajes`, `ciclos` y fuentes compartidas de costos | Solo consulta y descarga; Administrativo obtiene acceso según tu nueva tabla. |
| Cierre e históricos | `ciclos`, `lotes` | Cierre, reapertura y captura/corrección histórica solo Super Admin; los demás puestos autorizados consultan. |
| Paquete tecnológico | `recetas`, `adicionales`, `productos`, `parametros` | Solo Super Admin modifica recetas/adicionales. Los demás puestos indicados consultan. |
| Catálogos | `productos`, `ranchos`, `tablas`, `cultivos`, `variedades`, `viveros`, `choferes`, `congeladoras`, `problemas` | Super Admin y Administrativo capturan. Parámetros conserva su pantalla y permiso exclusivo de Super Admin. |

**Datos transversales:** `asignaciones` guarda los ranchos de cada persona y solo Super Admin lo modifica. `sistema` guarda la semana compartida; su actualización automática necesita un tratamiento específico para no dar permisos operativos a puestos de consulta. `alertas_direccion` alimenta los avisos de Dirección; se preservan sus permisos actuales y se restringe la creación automática al flujo autorizado.

**Fuentes compartidas de costos:** solicitudes de planta, recetas/adicionales, pedidos, recepciones, extraordinarios, devoluciones y parámetros. Su consulta para calcular cifras no implica permiso para escribirlas.

## Cambios a aplicar después de aprobar esta correspondencia

1. Actualizar menú, descripciones y permisos comunes de consulta/captura conforme a tu tabla, conservando Super Admin, Autorizador y Dirección.
2. Ocultar las acciones de captura en pantallas de consulta y bloquearlas también en las funciones que guardan. Encargado solo avanza aplicaciones; Ingeniero y Encargado solo registran salidas sin evaluación.
3. Habilitar recepción de receta, preparación y planta en Llegadas exclusivamente para Super Admin, Almacén y Encargado. Conservar compras/surtido de Compras sin concederle nuevas acciones de recepción en Llegadas.
4. Limitar Ingeniero y Encargado a sus ranchos asignados, incluidos filtros, listas, históricos y opciones de captura. Sin asignaciones mostrar listas vacías, no todos los ranchos.
5. Aplicar una migración aditiva de permisos, sin borrar ni recalcular registros existentes.
6. Probar la matriz completa por puesto, rechazos de escritura, restricciones por acción y ranchos; comprobar las pantallas con datos reales sin guardar operaciones ficticias.

## Detalles técnicos

- Centralizar `puedeCapturar(roles, path)` y permisos de acciones en `roles.ts`; usar unión de permisos cuando una persona tenga varios puestos.
- Reemplazar el `else tiene_puesto` de `puede_escribir` por una lista explícita de colecciones autorizadas y denegar colecciones desconocidas. Recetas/adicionales y evaluaciones quedan exclusivos de `admin`.
- Las colecciones compartidas requieren validación del cambio, no únicamente permiso sobre toda la colección: Ingeniero crea pedidos al planear pero no recibe; Encargado/Almacén reciben planta sin poder cambiar lo solicitado; Compras marca compra/surtido sin obtener facultades de planeación. Restringir campos, estados y operaciones mediante políticas y triggers.
- Extender `PERMISOS_COSECHA.viajes` y `proteger_viajes_campo` para Encargado. Guardar salidas nuevas con inserción explícita para que un upsert no requiera permiso de modificar viajes.
- Aplicar alcance de ranchos también en la base de datos, resolviendo referencias por lote/tabla y renglones de solicitudes o viajes. Evitar que una consulta directa permita saltar el filtro visual.
- Preservar el guardado por diferencias, los cambios remotos pendientes y el simulador sin escrituras; ajustar permisos de los efectos automáticos para evitar intentos de guardado de usuarios de consulta.
- Actualizar pruebas existentes y agregar casos concretos por puesto y acción, incluida ausencia de asignaciones y colecciones compartidas.

## Conservación

No se eliminan usuarios, ranchos, entregas, plantaciones, viajes ni históricos. Esta etapa presenta la correspondencia; todavía no modifica los permisos en la base de datos.