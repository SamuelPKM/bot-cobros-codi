import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/shared/ui/logo';

export const metadata: Metadata = { title: 'Aviso de privacidad · Cóbrale' };

// ANTES DE PUBLICAR: llena estos datos con los del responsable real (la
// persona del equipo titular de las credenciales de pey).
const RESPONSIBLE = {
  name: '[NOMBRE COMPLETO DEL RESPONSABLE]',
  address: '[DOMICILIO PARA OÍR Y RECIBIR NOTIFICACIONES]',
  email: '[CORREO DE CONTACTO PARA PRIVACIDAD]',
};
const UPDATED_AT = '24 de noviembre de 2026';

export default function PrivacidadPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center px-5 py-4">
          <Link href="/" aria-label="Cóbrale, inicio">
            <Logo size={32} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <article className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Aviso de privacidad</h1>
          <p className="mt-2 text-sm text-zinc-500">Última actualización: {UPDATED_AT}</p>

          <p className="mt-6 text-zinc-700">
            Este aviso explica qué datos personales trata Cóbrale, para qué y cómo puedes ejercer tus
            derechos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
            Particulares y su normativa. Cóbrale no es un producto oficial de pey ni de Banco de México.
          </p>

          <Section title="1. Quién es el responsable">
            <p>
              <strong>{RESPONSIBLE.name}</strong>, con domicilio en {RESPONSIBLE.address}, es responsable
              de los datos de las cuentas de Cóbrale. Para cualquier asunto de privacidad escribe a{' '}
              <strong>{RESPONSIBLE.email}</strong>.
            </p>
            <p>
              Cada negocio registrado cobra con su propia cuenta de pey. Respecto de los datos de las
              personas a quienes ese negocio les cobra, <strong>el responsable es el negocio</strong>, y
              Cóbrale los trata solo por su cuenta y para hacer el cobro.
            </p>
          </Section>

          <Section title="2. Qué datos tratamos">
            <List
              items={[
                <>
                  <strong>Del negocio y su equipo:</strong> nombre del negocio, nombre y usuario de cada
                  persona, contraseña (guardada solo como huella cifrada, nunca en texto), rol y tope por
                  cobro.
                </>,
                <>
                  <strong>Credenciales del negocio:</strong> la API key y el secreto del webhook de pey,
                  guardados cifrados.
                </>,
                <>
                  <strong>De los cobros:</strong> monto, concepto, fecha, estatus y, en los cobros al
                  celular, el número del cliente que paga. Los datos bancarios del pago los maneja pey y
                  el banco del cliente; Cóbrale solo recibe la clave de rastreo y el estatus.
                </>,
                <>
                  <strong>WhatsApp (opcional):</strong> el número de WhatsApp de quien vincula su cuenta y
                  los mensajes que manda al bot para cobrar.
                </>,
                <>
                  <strong>Datos técnicos:</strong> la dirección IP, para limitar abusos (en la demo se
                  guarda solo una huella de ella), y una cookie de sesión.
                </>,
              ]}
            />
            <p>No tratamos datos personales sensibles.</p>
          </Section>

          <Section title="3. Para qué los usamos">
            <p>Finalidades necesarias para el servicio:</p>
            <List
              items={[
                'Crear y administrar la cuenta del negocio y de su equipo, e iniciar sesión.',
                'Generar cobros CoDi (al celular, QR y liga de pago) con la cuenta de pey del negocio.',
                'Confirmar los pagos y avisarlos en la web y por WhatsApp.',
                'Mostrar al negocio sus cobros, resúmenes y reportes.',
                'Proteger el servicio: límites de uso, prevención de fraude y seguridad.',
                'Cumplir obligaciones legales y atender requerimientos de autoridad.',
              ]}
            />
            <p>
              No usamos los datos para publicidad ni para finalidades secundarias, y no los vendemos.
            </p>
          </Section>

          <Section title="4. Con quién los compartimos">
            <p>Solo con quien hace posible el servicio, que los trata por nuestra cuenta:</p>
            <List
              items={[
                <>
                  <strong>pey</strong>, para generar los cobros CoDi y confirmar los pagos, conforme a sus
                  términos y aviso de privacidad.
                </>,
                <>
                  <strong>Meta (WhatsApp)</strong>, solo si vinculas tu WhatsApp, para recibir y mandar
                  los mensajes del bot.
                </>,
                <>
                  <strong>Amazon Web Services</strong>, que hospeda la aplicación y la base de datos en
                  servidores en Estados Unidos.
                </>,
              ]}
            />
            <p>
              Estas remisiones no requieren tu consentimiento. Fuera de ellas, solo compartimos datos
              cuando la ley o una autoridad competente lo exigen.
            </p>
          </Section>

          <Section title="5. Tus derechos (ARCO)">
            <p>
              Puedes <strong>acceder</strong> a tus datos, <strong>rectificarlos</strong>,{' '}
              <strong>cancelarlos</strong> u <strong>oponerte</strong> a su tratamiento, así como revocar
              tu consentimiento o limitar su uso. Escribe a <strong>{RESPONSIBLE.email}</strong> con tu
              nombre, el usuario o teléfono relacionado, qué derecho quieres ejercer y una copia de tu
              identificación. Te respondemos en un máximo de 20 días hábiles y, si procede, lo hacemos
              efectivo dentro de los 15 días hábiles siguientes.
            </p>
            <p>
              Si eres cliente de un negocio que te cobró con Cóbrale, puedes dirigirte a ese negocio o a
              nosotros, y le haremos llegar tu solicitud.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              Usamos una sola cookie, necesaria para mantener tu sesión iniciada. No usamos cookies de
              publicidad ni de rastreo.
            </p>
          </Section>

          <Section title="7. Cuánto tiempo los guardamos">
            <p>
              Mientras la cuenta del negocio esté activa y, después, solo el tiempo que exijan las
              obligaciones legales y fiscales. Las conversaciones de la demo pública no piden cuenta ni
              datos de contacto.
            </p>
          </Section>

          <Section title="8. Cambios a este aviso">
            <p>
              Publicaremos cualquier cambio en esta página, con su fecha de actualización.
            </p>
          </Section>
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-2 flex flex-col gap-3 text-zinc-700">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
