# Luna — Documento de diseño

**Fecha:** 2026-07-05
**Estado:** Aprobado en brainstorming. **Revisado tras pivote a app web (Vercel + Supabase, multiusuario, online).**
**Autor del MVP previo:** Federico (maqueta HTML de una sola página).

---

## 1. Propósito

Luna es una **aplicación web** que asiste a una **parte litigante** (Defensa o Fiscalía/Querella) durante un **juicio por jurados** en la Provincia de Buenos Aires (Ley 14.543, que modifica el CPP Ley 11.922). Cubre tres momentos del juicio, con un asistente de IA ("Luna") transversal:

1. **Preparación del caso** (antes de la audiencia).
2. **Audiencia de selección de jurado** (voir dire), en vivo.
3. **Debate**: perfilado de testigos en tiempo real, en vivo.

Se usa desde la **notebook de la parte**. **Requiere internet** (app online; el offline/PWA quedó explícitamente fuera de v1).

## 2. Usuario y alcance

- **Usuario:** una parte litigante. El mismo sistema sirve para Defensa o Fiscalía/Querella; el rol se elige por caso.
- **Multiusuario:** varios litigantes se registran e ingresan con login; cada uno ve **solo sus casos** (aislamiento por usuario con RLS de Supabase).
- **NO** es una herramienta para la jueza (que es neutral). La lógica es estratégica de parte: perfil buscado/a evitar, favorable/desfavorable, preguntas para exponer sesgos, uso de recusaciones.
- **Jurisdicción:** diseñada para PBA (Ley 14.543). Los parámetros numéricos son configurables para adaptarse a otra provincia, pero no se diseña para el jurado federal.

## 3. Marco legal relevante (parámetros que la app respeta)

- Competencia del jurado: delitos con pena máxima en abstracto > 15 años (art. 22 bis).
- **48 aspirantes** convocados por juicio (art. 338 ter, inc. 5). Configurable.
- Jurado final: **12 titulares + 6 suplentes**, con **paridad de género obligatoria** (mitad y mitad, incluidos suplentes).
- **Recusaciones sin causa (perentorias): 4 por parte**, alternadas, empieza la acusación. Con pluralidad de partes hay adicionales (regla avanzada, opcional).
- **Recusaciones con causa: ilimitadas** (fundadas). **No pueden basarse en motivos discriminatorios** (art. 338 quáter, inc. 3).
- Orden de la audiencia: impedimentos → excusaciones → recusación con causa → recusación sin causa → sorteo final.
- En el debate, la **parte interroga** (examen directo y contraexamen). El juez y los jurados no pueden interrogar (fundamenta el toggle directo/contra).
- Veredicto (contexto): culpabilidad ≥ 10 votos; unanimidad si pena perpetua.

## 4. Arquitectura (app web)

- **Frontend:** React + TypeScript + **Vite**, desplegado en **Vercel** (build desde el repo GitHub `luna-lexagis/luna`).
- **Datos + Auth:** **Supabase** — Postgres gestionado + Auth (login por email) + Row-Level Security (RLS) para que cada usuario acceda solo a sus filas. El frontend usa `@supabase/supabase-js` con la **anon key** (pública); la seguridad real la garantiza RLS, no el secreto de la key.
- **Proxy de IA:** la **API key de Anthropic nunca vive en el navegador**. Vive como variable de entorno secreta en una **función serverless de Vercel** (`/api/luna`), que recibe la consulta del frontend (autenticada) y la reenvía a Anthropic. La anon key de Supabase sí es pública; la key de Anthropic **no**.
- **Deploy/CI:** push a GitHub → Vercel construye y publica. Variables de entorno en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend) y `ANTHROPIC_API_KEY` (solo en la función serverless).

**Por qué:** el usuario ya montó GitHub + Vercel + Supabase; multiusuario con login y datos centralizados encajan con web hospedada. TypeScript porque es una herramienta jurídica donde los errores (conteos, estados) se pagan caro.

## 5. Modelo de datos (Supabase / Postgres)

Un **caso = una fila** en la tabla `cases`. Las estructuras anidadas (aspirantes, testigos, perfiles, chats) se guardan como **JSONB** dentro de la fila — a esta escala (48 aspirantes, pocos testigos) es simple, atómico por caso y evita muchas tablas. Se normaliza más adelante solo si hace falta.

```
tabla: cases
├─ id                  uuid  (PK, default gen_random_uuid())
├─ user_id             uuid  (FK auth.users, default auth.uid())   -- dueño
├─ created_at          timestamptz default now()
├─ updated_at          timestamptz default now()
├─ caratula            text
├─ delito              text
├─ rol                 text   -- 'defensa' | 'fiscalia_querella'
├─ departamento_judicial text null
├─ fase_actual         text   -- 'preparacion' | 'seleccion' | 'debate'
└─ data                jsonb  -- { teoriaDelCaso, perfiles, seleccion, debate, chatsLuna }
```

- **RLS activado.** Políticas: `select/insert/update/delete` permitidos solo cuando `user_id = auth.uid()`.
- La forma del `data` (JSONB) y los tipos TS son el **mismo modelo** que ya definimos (rol, aspirante+estado, testigo+notas etiquetadas, etc.); viven en `src/shared/types.ts` como fuente de verdad y se serializan a/desde la fila.
- `updated_at` se refresca en cada guardado (trigger o desde el cliente).

## 6. Navegación

- **Login / registro** (Supabase Auth). Sin sesión → pantalla de acceso.
- **Biblioteca de casos** (inicio, ya autenticado): lista de los casos del usuario (carátula · delito · rol · fase · última edición) + "Nuevo caso". Acceso a **Ajustes** y **cerrar sesión**.
- **Vista de caso:** barra superior (carátula · rol · pestañas de fase) + **panel Luna** contextual a la derecha. Pestañas: Preparación · Audiencia de selección · Debate.
- **Exportar caso:** JSON y/o **informe legible** (para alegato/archivo).

## 7. Fase 1 — Preparación

Formulario (base del MVP, ahora funcional):
- Identificación: carátula, delito, **rol** (Defensa / Fiscalía-Querella), departamento judicial (opcional).
- Teoría del caso y datos del expediente: texto o **carga de PDF** (extracción de texto en el cliente, editable).
- **Detección de perfiles con Luna** (vía función serverless): perfil buscado / a evitar, editables.
- Config del panel: **48 aspirantes** (corregido, era 24) y **4 recusaciones sin causa por parte** (corregido).
- Panel Luna "preparación": estrategia, dónde flaquea la teoría, preguntas de selección.

## 8. Fase 2 — Audiencia de selección

- **Grilla de 48 aspirantes** con estados de color (favorable / en observación / desfavorable / recusado c/causa / recusado s/causa / en el jurado / pendiente), notas "lo que dijo", y panel Luna "estratega".
- **Panel final 12 + 6** con **medidor de paridad de género**; Luna avisa si se desbalancea.
- **Conteo de recusaciones:** las 4 sin causa se descuentan y se **bloquean en 0**; las con causa son **ilimitadas** (se registran, no se limitan).
- **Aviso de no discriminación** al recusar con causa (art. 338 quáter).
- Guía opcional del **orden legal** de la audiencia.

## 9. Fase 3 — Debate / perfilado de testigos (nueva)

- **Roster de testigos** (chips): nombre · ofrecido por · estado (por declarar / declarando / declaró) · "+ testigo".
- **Ficha del testigo activo:** identidad (nombre, ofrecido por, tipo); toggle **Examen directo / Contraexamen**; **notas en vivo con timestamp** etiquetables (**⚑ Contradicción**, **★ Alegato**, o dato); marcador de **credibilidad**; objeciones (opcional).
- **Vistas transversales:** **Contradicciones** (todas las ⚑) y **Alegato** (todas las ★, exportable).
- Panel Luna "debate": ve teoría + notas de todos los testigos; *¿qué contra-pregunto?*, *contradicciones del panel*, *puntos para el alegato*; detecta contradicciones cruzadas.

## 10. Luna (IA)

- Todas las consultas pasan por la **función serverless `/api/luna`** en Vercel (la key de Anthropic es una env var secreta ahí; nunca en el navegador). La función valida la sesión del usuario (token de Supabase) antes de llamar a Anthropic.
- **Contexto por fase:** rol, teoría, expediente, perfiles y estado vigente (panel de aspirantes o notas de testigos). Instrucciones: español rioplatense, directo, accionable; distinguir recusación con/sin causa; no inventar hechos; no sugerir preguntas discriminatorias.
- **Modelo:** modelo actual de Anthropic (id exacto se elige en implementación con la skill claude-api; **no** usar `claude-sonnet-4-6` del MVP, que no existe).
- **Errores:** si la función falla o no hay red, la app muestra aviso claro y reintento; el resto de la UI sigue usable.

## 11. Fiabilidad

- **Online:** la app lee/escribe directo a Supabase; requiere internet.
- **Autosave** por caso (guardado con debounce a Supabase); indicador "Guardando/Guardado".
- Manejo de errores de red en cada operación (reintento, aviso), sin perder lo tipeado en el formulario activo.

## 12. Estética / UX

- Identidad actual: oscuro `#0D1117` + ámbar `#E0A44C`, Inter + JetBrains Mono, tarjetas redondeadas, etiquetas mono en mayúscula. Se pule: espaciado consistente, contraste accesible, colores de estado claros.
- **Optimizada para tipear rápido en vivo:** atajos de teclado (agregar nota, etiquetar contradicción/alegato), foco estable, targets grandes, legibilidad a un vistazo.

## 13. Testing

Construcción con **TDD** donde aplica (lógica pura). Tests unitarios (Vitest) de:
- Conteo de recusaciones (4 por parte, bloqueo en 0).
- Cálculo de paridad de género del panel final.
- Capacidad del panel final (12 titulares + 6 suplentes).
- Transiciones de estado de aspirantes.
- Agregación de contradicciones y puntos de alegato.
- Mapeo fila Supabase ↔ objeto `Case`.
La CRUD contra Supabase y el flujo de auth se verifican con pruebas manuales E2E (y opcionalmente e2e automatizado más adelante).

## 14. Fuera de alcance (v1 — YAGNI)

- Sin offline/PWA (requiere internet).
- Sin tiempo real colaborativo (un usuario edita su caso).
- Sin grabación/transcripción de audio (solo notas escritas).
- Sin integración con sistemas del Poder Judicial.
- No es herramienta para la jueza.
- No se diseña para el jurado federal.

## 15. A decidir en implementación

- Id exacto del modelo de Anthropic (usar skill claude-api).
- Método de login de Supabase (email+contraseña vs magic link).
- Formato preciso del informe legible de exportación.
- Si en algún momento conviene normalizar aspirantes/testigos a tablas propias (por ahora JSONB).
