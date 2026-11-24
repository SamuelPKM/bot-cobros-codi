# Instrucciones para probar el proyecto

> Borrador. Antes de entregar, cambia `[URL]`, `[USUARIO DE PRUEBA]` y `[CONTRASEÑA DE PRUEBA]` por los reales y revisa que sigan siendo menos de 1000 palabras.

Cóbrale permite a un negocio cobrar con CoDi escribiendo un mensaje o desde una web sencilla. Se prueba sin instalar nada, de dos formas: en el **panel web** con una cuenta de prueba, o en la **demo de chat**, que funciona igual que el bot de WhatsApp.

- **Sitio:** [URL]
- **Cuenta de prueba del panel:** [USUARIO DE PRUEBA] / [CONTRASEÑA DE PRUEBA]
- **Demo de chat, sin cuenta:** [URL]/demo

## Antes de empezar

- Los cobros son **reales**: usan el ambiente productivo de pey. El dinero llega a la cuenta del negocio de demostración del equipo y no se devuelve, así que prueba con **$0.01**. La cuenta de prueba y la demo no aceptan más de $1.00 por cobro.
- Para el cobro al celular necesitas un número con CoDi activo en la app de tu banco.
- Para el QR necesitas una app bancaria que escanee códigos CoDi. Si solo tienes un dispositivo, abre el sitio en una computadora y escanea con tu celular.

## A. Panel web (cuenta de prueba)

1. Entra a [URL], da clic en **Entrar** y usa la cuenta de prueba.
2. **Cobro al celular.** En **Nuevo cobro** elige "Push al celular", escribe tu celular, `0.01` y un concepto, y da clic en **Cobrar**. Te llega la solicitud a la app de tu banco; apruébala. La página del cobro cambia sola a **✅ Pagado**.
3. **Plan B.** Si el push no te llega, en esa misma página usa **Mostrar QR** o **Liga de pago**: es el mismo cobro, no se cobra dos veces.
4. **QR.** En **Nuevo cobro** elige "QR" y `0.01`. Aparece el QR, vigente 15 minutos. Escanéalo con tu banco y paga: la página cambia sola a **Pagado**.
5. **Liga de pago.** Elige "Liga de pago" y `0.01`. Copia la liga, ábrela y paga con CoDi o con tarjeta. Al terminar, pey te regresa a una página de Cóbrale.
6. **Panel.** Ves lo cobrado hoy, lo pendiente y lo vencido, los últimos cobros y **Descargar CSV** (hoy o un rango de hasta 93 días; abre en Excel con acentos).
7. **Ajustes.** Ahí cada persona liga su WhatsApp con un código. El administrador además ve la URL del webhook de pey de su negocio y los últimos 4 caracteres de su API key.
8. **Equipo** (si tu cuenta es administradora). Crea una invitación: aparece una liga de un solo uso. Ábrela en una ventana privada y crea una cuenta. Cobra como esa persona: ve solo sus cobros. En la ventana del administrador ves los cobros de los dos, quién cobró cada uno y los totales de hoy por persona. También puedes ponerle un tope por cobro o desactivarla.

También puedes registrar tu propio negocio en **Registra tu negocio**, con la API key de tu cuenta de pey: tus cobros llegan a tu cuenta.

## B. Demo de chat (sin cuenta)

Abre [URL]/demo. Escribes como lo harías por WhatsApp:

| Escribe | Qué pasa |
| --- | --- |
| `qr 0.01 prueba` | Muestra un QR para escanear; al pagar aparece "✅ Pagado" en el chat |
| `liga 0.01 prueba` | Da una liga de pago |
| `liga` | La liga de tu último cobro pendiente |
| `resumen` | Lo cobrado hoy y lo pendiente |
| `ayuda` | La lista de comandos |

Cada visitante tiene su propia conversación: nadie ve ni confirma los cobros de otro.

La demo pública **no manda cobros push** (`cobra 0.01 a <celular>` responde que no está disponible): como no pide cuenta, cualquiera podría mandarle una solicitud de pago al celular de otra persona. El cobro al celular se prueba en el panel con la cuenta de prueba (sección A, paso 2) o por WhatsApp.

## Qué más puedes probar

- Un monto mayor a $1.00: se rechaza con el tope.
- Un teléfono con lada o espacios (`+52 55 1234 5678`): se entiende igual.
- Por WhatsApp, enviar dos veces "sí": no se manda un segundo cobro.
- Abrir el enlace de un cobro de otro negocio, o de otro vendedor siendo vendedor: no se muestra.
- Como vendedor, abrir `/panel/equipo`: te regresa al panel.
- Quitarle el rol de administrador al único que queda: no se permite.
- Reusar una liga de invitación: dice que ya no sirve.

## Cómo usa el API de pey

- **Push CoDi:** `POST /codi/pn`.
- **QR CoDi:** `POST /codi/qr`, con 15 minutos de vigencia. El servidor dibuja el QR con el `qrString` tal cual lo entrega pey.
- **Liga de pago:** `POST /payment-link/create`, con regreso a la web al pagar o cancelar.
- **Cada negocio con su API key:** se verifica con pey al registrarlo y se guarda cifrada; sus cobros, consultas y webhooks usan solo esa key.
- **Confirmación del pago:** webhooks firmados (Standard Webhooks), con una URL por negocio. Antes de avisar, el servidor confirma el pago y su monto contra la API (`GET /transaction/{id}`, `GET /payment-link/{id}`).
- **Si un webhook no llega:** al vencer un cobro, el servidor consulta la API (`GET /transaction/{id}`, `GET /transaction/codi/qr/{id}`, `GET /payment-link/{id}`) antes de darlo por vencido.

El panel, el bot de WhatsApp y la demo usan el mismo núcleo de cobros.

## Si algo no funciona

- **No te llega la notificación:** revisa que tu número tenga CoDi activo, o usa QR o liga.
- **El sitio tarda en abrir:** puede estar despertando; espera unos segundos.
- **Llegaste a un límite:** máximo 3 cobros push por hora al mismo celular; en la demo, 10 cobros por hora y 30 mensajes cada 10 minutos. Espera un rato.

Repositorio: [ENLACE AL REPOSITORIO, opcional]
