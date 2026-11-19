// `npm run build`: Cóbrale no se compila, pero el build revisa que el servidor
// pueda arrancar, para que un error salga en el build y no ya publicado:
//   - la versión de Node.js (node:sqlite necesita la 22.5 o más nueva);
//   - que todos los módulos de src/ carguen, con sus dependencias instaladas.

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Cóbrale necesita Node.js 22.5 o más nuevo, y este build usa ${process.versions.node}.`);
  console.error('En Render, revisa que exista el archivo .node-version con "22".');
  process.exit(1);
}

const modules = ['app', 'bot', 'command', 'config', 'db', 'demo', 'messages', 'outbox', 'pey', 'whatsapp'];
for (const name of modules) {
  await import(`../src/${name}.js`);
}

const { openDb } = await import('../src/db.js');
openDb(':memory:').close();

console.log(`Build listo: Node.js ${process.versions.node}, ${modules.length} módulos cargan bien.`);
