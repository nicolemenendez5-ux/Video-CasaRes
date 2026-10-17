# Brief: Tablero semanal de productividad

## Objetivo

Un tablero personal que muestra en una sola página cómo va la semana (agenda, correo, entregables) y la orienta hacia lo que mueve el negocio (ventas, tkt, costo, contribución). Reemplaza el plan semanal que hoy se hace en papel.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Formato | Página privada en claude.ai (Artifact), actualizada por Claude |
| Imagen | Neutra y funcional: fondo claro, una sola tipografía sans, sin colores de marca |
| Agenda y correo | Outlook vía el conector **Microsoft 365** |
| Métricas semanales | Excel en **OneDrive/SharePoint**, leído con el mismo conector |
| Plan semanal | Se captura **en el propio tablero** (hoy se hace en papel) y se guarda en la base de datos del Artifact |

## Prerrequisitos

1. **Terminar la conexión del conector Microsoft 365** en claude.ai → Settings → Connectors. Ya está instalado, pero la conexión quedó sin terminar. Si la empresa pide que un administrador apruebe el acceso, hay que pedírselo a TI.
2. **El conector solo lee.** Puede buscar correo, calendario y archivos de OneDrive/SharePoint, pero no crea eventos. Por eso los bloques de foco se **sugieren**, no se reservan solos. Para reservarlos de forma automática haría falta Microsoft Graph con permiso de escritura en el calendario (requiere aprobación de TI). Lo dejamos para una segunda fase.

## Datos por confirmar

- Ruta o nombre del Excel de métricas, hoja y nombres de columnas.
- Cómo se identifica la semana en el Excel (número de semana, fecha de inicio, etc.).
- Definiciones: ¿tkt = ticket promedio (ventas ÷ número de tickets)? ¿contribución = ventas − costo, en $ o en %?
- Horario laboral para calcular las horas libres (por defecto L–V, 9:00–18:00) y zona horaria.

## Secciones

### 1. Hoy y la semana
- Agenda de Outlook resumida: **máximo 5 bullets** con lo más relevante, no la lista completa.
- Qué cuenta como relevante: reuniones con externos o con dirección, conflictos (eventos que se enciman), reuniones que requieren preparación y entregas con fecha.
- La lista completa queda disponible en una sección plegable.

### 2. Reuniones vs. horas libres
- `% en reuniones = horas en reuniones ÷ horas laborales de la semana`.
- `Horas para trabajo propio = horas laborales − horas en reuniones`.
- Si dos reuniones se enciman, el tiempo se cuenta una sola vez. No se cuentan los eventos de todo el día ni los marcados como "Libre".

### 3. Bloques de foco
- Los huecos libres más largos dentro del horario laboral, **de 60 minutos o más**, ordenados por duración (los 5 primeros).
- Cada bloque se puede asignar a un entregable del plan semanal. El evento se crea a mano en Outlook (ver Prerrequisitos, punto 2).

### 4. Correo
- **Pendientes por responder**, del más antiguo al más reciente: hilos de los últimos 14 días donde tú estás en "Para", el último mensaje no es tuyo y no son boletines ni notificaciones automáticas. Se muestra remitente, asunto y días de espera.
- **Resumen del día**: de 3 a 5 bullets con lo importante del correo recibido hoy.

### 5. Plan semanal y cumplimiento (reemplaza el papel)
- **El lunes**: capturas tus entregables en el tablero (título, prioridad alta/media/baja y fecha objetivo opcional).
- **Durante la semana**: los marcas como cerrados con un clic.
- `Avance = entregables planeados el lunes y cerrados ÷ entregables planeados el lunes`.
- Lo que se agregue después del lunes aparece como "no planeado": se ve en la lista, pero no cuenta para el porcentaje.
- Se guarda en la base de datos del Artifact, así que no se pierde entre semanas y Claude puede leerlo.

### 6. Foco de la semana (la propuesta de valor)
1. Compara la semana actual con la anterior en ventas, tkt, costo y contribución, y elige la métrica con el **movimiento desfavorable más grande** (bajar es malo en ventas, tkt y contribución; subir es malo en costo). Solo se marca si el cambio es de **3% o más** (umbral ajustable).
2. Propone **3 prioridades** con base en esta tabla:

   | Señal | Acción sugerida |
   |---|---|
   | Ventas ↓ | Revisar tráfico y conversión; activar comunicación en las categorías que más venden |
   | Tkt ↓ | Upselling: combos y productos complementarios |
   | Costo ↑ | Revisar mermas, precios de proveedores y mezcla de productos |
   | Contribución ↓ | Promoción en las categorías de mejor margen |

3. Cada prioridad se convierte en una tarea concreta, se agrega al plan semanal y se le asigna uno de los bloques de foco de la sección 3.

### 7. Cierre del viernes
- Qué se cumplió, qué quedó pendiente y cómo se movieron las métricas.
- Botón "Pasar a la próxima semana" para los pendientes, que quedan precargados en el plan del lunes siguiente.

## Actualización

- Claude actualiza el tablero cuando se le pide y, opcionalmente, con tareas programadas: **lunes temprano** (semana nueva, métricas de la semana anterior y Foco de la semana) y **viernes por la tarde** (cierre).
- Las tareas programadas necesitan acceso al conector Microsoft 365.

## Prompt para Claude Code

> Construye el tablero descrito en `docs/brief-tablero-semanal.md` como una página privada en claude.ai. Usa el conector Microsoft 365 para leer el calendario y el correo de Outlook y el Excel de métricas en OneDrive/SharePoint. Guarda el plan semanal en la base de datos del Artifact. Diseño neutro y funcional, legible en el celular. Antes de empezar, confírmame los datos de la sección "Datos por confirmar".
