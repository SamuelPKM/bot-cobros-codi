// Configuración leída de variables de entorno (ver .env.example).

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}. Revisa tu archivo .env (ver .env.example).`);
    process.exit(1);
  }
  return value;
}

export function loadConfig({ needWebhookSecret = false } = {}) {
  return {
    peyApiKey: required('PEY_API_KEY'),
    peyWebhookSecret: needWebhookSecret ? required('PEY_WEBHOOK_SECRET') : process.env.PEY_WEBHOOK_SECRET,
    peyBaseUrl: process.env.PEY_BASE_URL || 'https://api.pey.mx',
    port: Number(process.env.PORT || 3000),
    dataFile: process.env.DATA_FILE || 'data/cobros.json',
  };
}
