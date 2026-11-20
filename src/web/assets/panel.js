// Comportamiento del panel: muestra el campo de teléfono solo para cobros al
// celular, copia ligas, y actualiza los estados de los cobros sin recargar.
(() => {
  const POLL_MS = 5000;

  // Campo de teléfono solo para "Al celular".
  const form = document.getElementById('new-charge');
  if (form) {
    const update = () => {
      const kind = form.querySelector('input[name="tipo"]:checked')?.value;
      form.querySelectorAll('[data-only]').forEach((el) => {
        const show = el.dataset.only === kind;
        el.hidden = !show;
        el.querySelectorAll('input').forEach((input) => {
          input.required = show;
        });
      });
    };
    form.addEventListener('change', update);
    update();
  }

  // Filtros que se aplican al elegir.
  document.querySelectorAll('select[data-autosubmit]').forEach((select) => {
    select.addEventListener('change', () => select.form.submit());
  });

  // Copiar al portapapeles.
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const input = document.querySelector(button.dataset.copy);
      try {
        await navigator.clipboard.writeText(input.value);
        button.textContent = 'Copiada';
      } catch {
        input.select();
      }
    });
  });

  const waiting = ['pending', 'unknown', 'qr', 'link', 'sending', 'creating', 'link_creating'];

  // Lista de cobros: actualiza estado y totales. Solo pregunta mientras haya
  // cobros en espera, para no despertar la base sin motivo.
  const table = document.getElementById('charges');
  if (table) {
    const poll = async () => {
      if (document.hidden) return;
      const rows = [...table.querySelectorAll('tbody tr')];
      if (!rows.some((row) => waiting.includes(row.dataset.status))) return;
      try {
        const response = await fetch('/panel/api/cobros', { headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const data = await response.json();
        for (const charge of data.charges) {
          const row = table.querySelector(`tr[data-id="${charge.id}"]`);
          if (row && row.dataset.status !== charge.status) {
            row.dataset.status = charge.status;
            row.querySelector('.status-cell').innerHTML = charge.chip;
            row.classList.add('changed');
          }
        }
        document.getElementById('stat-paid').textContent = data.summary.totalPaid;
        document.getElementById('stat-pending').textContent = data.summary.pending;
        document.getElementById('stat-expired').textContent = data.summary.expired;
      } catch {
        // Sin conexión: se intenta en la siguiente vuelta.
      }
    };
    setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
  }

  // Detalle de un cobro en espera: recarga cuando cambia el estado.
  const detail = document.querySelector('[data-charge]');
  if (detail && waiting.includes(detail.dataset.status)) {
    const poll = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/panel/api/cobros/${detail.dataset.charge}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const { charge } = await response.json();
        if (charge.status !== detail.dataset.status) window.location.reload();
      } catch {
        // Se intenta en la siguiente vuelta.
      }
    };
    setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
  }
})();
