document.addEventListener("DOMContentLoaded", function () {
  let selectedPartes = [];

  // Cargar partes desde JSON
  async function loadPartes() {
    const container = document.getElementById('partesListContainer');
    try {
      const res = await fetch("data/partesid.json");
      if (!res.ok) throw new Error("No se pudo cargar el archivo JSON");

      const partes = await res.json();

      const html = partes.map(parte => `
        <div class="list-group-item">
          <div class="form-check">
            <input class="form-check-input parte-checkbox" type="checkbox" value="${parte.id}" id="parte-${parte.id}">
            <label class="form-check-label" for="parte-${parte.id}">
              <strong>${parte.id}</strong> - ${parte.description}
            </label>
          </div>
        </div>
      `).join('');

      container.innerHTML = html;

      // Restablecer checkboxes seleccionados previamente
      selectedPartes.forEach(id => {
        const checkbox = document.querySelector(`input[value="${id}"]`);
        if (checkbox) checkbox.checked = true;
      });

      // Filtro en tiempo real
      document.getElementById('buscarParteInput').addEventListener('input', filterPartes);

    } catch (err) {
      console.error("Error al cargar las partes:", err);
      container.innerHTML = '<div class="alert alert-danger">No se pudieron cargar las partes</div>';
    }
  }

  // Filtrar partes
  function filterPartes() {
    const text = document.getElementById('buscarParteInput').value.toLowerCase();
    document.querySelectorAll('.list-group-item').forEach(item => {
      const content = item.textContent.toLowerCase();
      item.style.display = content.includes(text) ? '' : 'none';
    });
  }

  // Actualizar visualización de partes seleccionadas
  function updateSelectedPartesDisplay() {
    const container = document.getElementById('selectedPartsContainer');
    const input = document.getElementById('parteRecibidaId');

    if (selectedPartes.length > 0) {
      input.value = selectedPartes.join(', ');
      input.classList.remove('is-invalid');
      container.innerHTML = selectedPartes.map(id => `
        <span class="badge bg-primary me-2 position-relative">
          ${id}
          <button class="btn-close btn-close-white position-absolute top-0 start-100 translate-middle"
                  data-id="${id}" style="font-size: 0.6rem; padding: 0.25rem;"></button>
        </span>
      `).join('');

      document.querySelectorAll('.btn-close').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.target.dataset.id;
          selectedPartes = selectedPartes.filter(partId => partId !== id);
          updateSelectedPartesDisplay();
        });
      });
    } else {
      input.value = '';
      container.innerHTML = '';
    }
  }

  // Confirmar selección
  document.getElementById('confirmarSeleccionBtn').addEventListener('click', function () {
    const selectedCheckboxes = document.querySelectorAll('.parte-checkbox:checked');
    selectedPartes = Array.from(selectedCheckboxes).map(cb => cb.value);
    updateSelectedPartesDisplay();
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('partesModal'));
    if (modalInstance) modalInstance.hide();
  });

  // Evento al abrir el modal
  document.getElementById('seleccionarParteBtn').addEventListener('click', loadPartes);
});
