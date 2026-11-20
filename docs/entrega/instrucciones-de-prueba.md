# Instrucciones para probar el proyecto

> Borrador. Antes de entregar, cambia `[URL]`, `[CORREO DE PRUEBA]` y `[CONTRASEÑA DE PRUEBA]` por los reales y revisa que sigan siendo menos de 1000 palabras.

Cóbrale permite a un negocio cobrar con CoDi escribiendo un mensaje o desde una web sencilla. Se prueba sin instalar nada, de dos formas: en el **panel web** con una cuenta de prueba, o en la **demo de chat**, que funciona igual que el bot de WhatsApp.

- **Sitio:** [URL]
- **Cuenta de prueba del panel:** [CORREO DE PRUEBA] / [CONTRASEÑA DE PRUEBA]
- **Demo de chat, sin cuenta:** [URL]/demo

## Antes de empezar

- Los cobros son **reales**: usan el ambiente productivo de pey. El dinero llega a la cuenta del proyecto y no se devuelve, así que prueba con **$0.01**. La cuenta de prueba y la demo no aceptan más de $1.00 por cobro.
- Para el cobro al celular necesitas un número con CoDi activo en la app de tu banco.
- Para el QR necesitas una app bancaria que escanee códigos CoDi. Si solo tienes un dispositivo, abre el sitio en una computadora y escanea con tu celular.

## A. Panel web (cuenta de prueba)

1. Entra a [URL], da clic en **Entrar** y usa la cuenta de prueba.
2. **Cobro al celular.** En "Nuevo cobro" elige "Al celular de mi cliente", escribe `0.01`, un concepto y tu celular. Da clic en **Continuar**: Cóbrale te muestra el resumen y todavía no envía nada. Da clic en **Enviar cobro**. Te llega la solicitud a la app de tu banco; apruébala. En unos segundos la página cambia sola a **Pagado**, con la clave de rastreo de Banxico.
3. **QR.** Elige "Con QR", `0.01` y **Continuar**. Aparece el QR, vigente 15 minutos. Escanéalo con tu banco y paga: la página cambia sola a **Pagado**.
4. **Liga de pago.** Elige "Con liga de pago", `0.01` y **Continuar**. Copia la liga, ábrela y paga con CoDi o con tarjeta.
5. **Panel.** En **Cobros** ves lo cobrado hoy, lo pendiente y la lista de cobros, que se actualiza sola. **Descargar CSV** exporta todos los cobros.
6. **Ajustes.** Ahí cada persona cambia su nombre y liga su WhatsApp. El administrador además cambia el nombre que ve el cliente en el banco y registra la CLABE del negocio para que los pagos le lleguen directo. La CLABE se valida con el dígito verificador y luego con Banxico, en hasta 5 días hábiles. Por eso la cuenta de prueba no tiene CLABE propia.
7. **Equipo.** La cuenta de prueba es administradora. En **Equipo** invita a un vendedor con tu nombre y otro correo: aparece una liga. Ábrela en una ventana privada y elige una contraseña. Crea un cobro como vendedor: ves solo tus cobros. Vuelve a la ventana del administrador: ves los cobros de los dos, quién vendió cada uno, los totales de hoy por persona y un filtro por persona.

También puedes crear tu propia cuenta en **Crear cuenta**. Mientras no tenga CLABE validada, queda en el mismo modo prueba.

## B. Demo de chat (sin cuenta)

Abre [URL]/demo. Ahí tú eres el comerciante "Negocio de prueba" y escribes como lo harías por WhatsApp:

| Escribe | Qué pasa |
| --- | --- |
| `cobra 0.01 a <tu celular> prueba` | Muestra el cobro y pide confirmación |
| `sí` | Te llega la solicitud a tu banco; al pagar aparece "✅ Pagado" en el chat |
| `qr 0.01 prueba` | Muestra un QR para escanear |
| `liga 0.01 prueba` | Da una liga de pago |
| `resumen` | Lo cobrado hoy y lo pendiente |
| `ayuda` | La lista de comandos |

Si un cobro al celular vence sin pagarse, el asistente avisa y ofrece una liga, que no necesita CoDi: responde `liga`. Tu conversación se guarda en ese navegador.

## Qué más puedes probar

- Un monto mayor a $1.00: se rechaza con una explicación del modo prueba.
- Un teléfono con lada o espacios (`+52 1 55 1234 5678`): se entiende igual.
- Enviar dos veces la confirmación: no se manda un segundo cobro.
- En el panel, abrir el enlace de un cobro de otra cuenta, o el de otro vendedor siendo vendedor: no se muestra.
- Como vendedor, abrir `/panel/equipo`: solo los administradores pueden.
- Quitarle el rol de administrador al único que queda: no se permite.

## Cómo usa el API de pey

- **Push CoDi:** `POST /codi/pn`, con 6 minutos de vigencia.
- **QR CoDi:** `POST /codi/qr`, con 15 minutos de vigencia. El servidor dibuja el QR con el `qrString` tal cual lo entrega pey.
- **Liga de pago:** `POST /payment-link/create`.
- **CLABE de cada comerciante:** `POST /bank-account` y `GET /bank-account/{id}`. Con la cuenta activa, los push y QR se crean con su `bankAccountId` y el dinero le llega directo.
- **Confirmación del pago:** webhooks firmados (`codi.pn.payment_received`, `codi.qr.payment_received`, `payment_link.status_updated`, `bank.account.updated`), verificados con Standard Webhooks. Antes de avisar, el servidor confirma cada pago contra la API (`GET /transaction/{id}`, `GET /payment-link/{id}`).
- **Si un webhook no llega:** al vencer un cobro, el servidor consulta la API (`GET /transaction/{id}` o `GET /transaction/codi/qr/{id}`) antes de darlo por expirado.

Cada cobro lleva su identificador interno en `metadata`, para ligar el pago aunque se pierda una respuesta. El panel, el bot de WhatsApp y la demo usan el mismo núcleo de cobros.

## Si algo no funciona

- **No te llega la notificación:** revisa que tu número tenga CoDi activo, o prueba con QR o liga.
- **El servicio tarda en abrir:** puede estar despertando; espera unos segundos.
- **Llegaste a un límite:** el modo prueba permite 10 cobros por hora y 3 cobros por hora a un mismo celular. Espera una hora.

Repositorio: [ENLACE AL REPOSITORIO, opcional]
