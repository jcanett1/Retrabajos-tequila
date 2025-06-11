document.addEventListener('DOMContentLoaded', async function () {
  // ✅ Configuración de Supabase
  const supabaseUrl = 'https://hckbtzbcmijdstyazwoz.supabase.co'; 
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhja2J0emJjbWlqZHN0eWF6d296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU4MDcsImV4cCI6MjA2NTA4MTgwN30.JfYJwuytLNXY42QcfjdilP4btvKu17gr84dbUQ_nMBk';
  const { createClient } = supabase;
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  let selectedPartes = [];

  // ✅ Inicialización de Flatpickr
 const esLocale = flatpickr.l10ns.es || flatpickr.l10ns.default;

flatpickr("#fechaCreacion", {
  locale: esLocale,
  dateFormat: "d/m/Y",
  allowInput: true,
  defaultDate: new Date()
});

flatpickr("#filtroFecha", {
  locale: esLocale,
  mode: "range",
  dateFormat: "d/m/Y",
  allowInput: true
});

  // ✅ Cargar partes desde JSON
async function loadPartes() {
  const container = document.getElementById('partesListContainer');
  try {
    // 1. Definir la ruta CORRECTA según tu estructura
    const jsonPath = "partesid.json"; // Ahora está en la misma carpeta que el HTML
    
    // 2. Verificar disponibilidad del archivo
    console.log("Intentando cargar JSON desde:", jsonPath);
    const response = await fetch(jsonPath);
    
    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${errorDetails}`);
    }
    
    // 3. Parsear y validar el contenido
    const partes = await response.json();
    console.log("Datos recibidos:", partes);
    
    if (!Array.isArray(partes)) {
      throw new Error("El formato del JSON no es válido. Se esperaba un array.");
    }
    
    // 4. Generar la interfaz de usuario
    const html = partes.map(parte => {
      if (!parte.id || !parte.description) {
        console.warn("Parte con formato incorrecto:", parte);
        return '';
      }
      return `
        <div class="list-group-item">
          <div class="form-check">
            <input class="form-check-input parte-checkbox" type="checkbox" 
                   value="${parte.id}" id="parte-${parte.id}">
            <label class="form-check-label" for="parte-${parte.id}">
              <strong>${parte.id}</strong> - ${parte.description}
            </label>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html || '<div class="alert alert-warning">No hay partes disponibles</div>';

    // Restaurar selecciones previas
    selectedPartes.forEach(id => {
      const checkbox = document.querySelector(`input[value="${id}"]`);
      if (checkbox) checkbox.checked = true;
    });

    // Configurar filtro en tiempo real
    document.getElementById('buscarParteInput').addEventListener('input', filterPartes);

  } catch (error) {
    console.error("Error al cargar partes:", error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error al cargar las partes</strong><br>
        ${error.message}<br>
        <small>Verifique la consola para más detalles</small>
      </div>`;
  }
}

  // ✅ Filtrar partes en el modal
  function filterPartes() {
    const text = document.getElementById('buscarParteInput').value.toLowerCase();
    document.querySelectorAll('.list-group-item').forEach(item => {
      const content = item.textContent.toLowerCase();
      item.style.display = content.includes(text) ? '' : 'none';
    });
  }

  // ✅ Actualizar visualización de partes seleccionadas
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

  // ✅ Validar formulario
  function validateForm() {
    let isValid = true;
    const requiredFields = document.querySelectorAll('#retrabajoForm input[required], #retrabajoForm select[required]');

    requiredFields.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('is-invalid');
        isValid = false;
      } else {
        input.classList.remove('is-invalid');
      }
    });

    const isParteValid = selectedPartes.length > 0;
    document.getElementById('parteRecibidaId').classList.toggle('is-invalid', !isParteValid);

    return isValid && isParteValid;
  }

  // ✅ Resetear formulario
  function resetForm() {
    document.querySelectorAll('#retrabajoForm input, #retrabajoForm select').forEach(input => {
      if (input.type === 'text' || input.type === 'number') {
        input.value = '';
      } else if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      }
      input.classList.remove('is-invalid');
    });

    selectedPartes = [];
    updateSelectedPartesDisplay();

    flatpickr("#fechaCreacion", {
      locale: "es",
      dateFormat: "d/m/Y",
      defaultDate: new Date()
    });
  }

  // ✅ Cargar tabla desde Supabase
  async function updateTable() {
    const tbody = document.querySelector('#retrabajosTable tbody');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">Cargando datos...</td></tr>`;

    const { data, error } = await supabaseClient.from('retrabajos').select('*');

    if (error) {
      console.error("Error al cargar datos:", error);
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Error al cargar los datos</td></tr>`;
      return;
    }

    const filteredData = filterData(data);

    if (filteredData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay datos</td></tr>`;
    } else {
      tbody.innerHTML = filteredData.map(item => `
        <tr>
          <td>${item.fecha}</td>
          <td>${item.orden}</td>
          <td>${item.tipoDefecto}</td>
          <td>${item.celda}</td>
          <td>${item.codigoDefecto}</td>
          <td>${item.parteId}</td>
          <td>${item.cantidad}</td>
        </tr>
      `).join('');
    }
  }

  // ✅ Filtrar datos por celda y fecha
  function filterData(data) {
    let filtered = [...data];
    const filtroCelda = document.getElementById('filtroCelda')?.value;
    const filtroFecha = document.getElementById('filtroFecha')?.value;

    if (filtroCelda && filtroCelda !== 'todas') {
      filtered = filtered.filter(item => item.celda === filtroCelda);
    }

    if (filtroFecha) {
      const [start, end] = filtroFecha.split(' a ').map(parseDate);
      if (start && end) {
        filtered = filtered.filter(item => {
          const itemFecha = parseDate(item.fecha);
          return itemFecha >= start && itemFecha <= end;
        });
      }
    }

    return filtered;
  }

  function parseDate(dateString) {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
  }

  // ✅ Insertar datos en Supabase
  document.getElementById('retrabajoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    const fecha = document.getElementById('fechaCreacion').value;
    const orden = document.getElementById('numeroOrden').value;
    const tipoDefecto = document.getElementById('tipoDefecto').value;
    const celda = document.getElementById('celda').value;
    const codigoDefecto = document.getElementById('codigoDefecto').value;
    const cantidad = parseInt(document.getElementById('cantidad').value);

    for (const parteId of selectedPartes) {
      const nuevoRetrabajo = {
        fecha,
        orden,
        tipoDefecto,
        celda,
        codigoDefecto,
        parteId,
        cantidad
      };

      const { error } = await supabaseClient.from('retrabajos').insert([nuevoRetrabajo]);
      if (error) {
        console.error("Error al guardar:", error);
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'No se pudo guardar el retrabajo.' });
        return;
      }
    }

    updateTable();
    resetForm();
    Swal.fire({ icon: 'success', title: 'Guardado', timer: 2000, showConfirmButton: false });
  });

  // ✅ Botones de exportación
  document.getElementById('exportExcelBtn').addEventListener('click', function () {
    const table = document.querySelector('#retrabajosTable');
    const wb = XLSX.utils.table_to_book(table, { sheet: "Retrabajos" });
    XLSX.writeFile(wb, `Retrabajos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  document.getElementById('exportPdfBtn').addEventListener('click', function () {
    const doc = new jspdf.jsPDF();
    const head = [['Fecha', 'Orden', 'Tipo Defecto', 'Celda', 'Código', 'Parte', 'Cantidad']];
    const body = Array.from(document.querySelectorAll('#retrabajosTable tbody tr')).map(row => {
      return Array.from(row.children).map(cell => cell.innerText);
    });

    doc.autoTable({
      head: head,
      body: body,
      startY: 20
    });

    doc.save('Retrabajos.pdf');
  });

  // ✅ Eventos iniciales
  document.getElementById('seleccionarParteBtn')?.addEventListener('click', loadPartes);
  document.getElementById('confirmarSeleccionBtn')?.addEventListener('click', function () {
    const selectedCheckboxes = document.querySelectorAll('.parte-checkbox:checked');
    selectedPartes = Array.from(selectedCheckboxes).map(cb => cb.value);
    updateSelectedPartesDisplay();
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('partesModal'));
    if (modalInstance) modalInstance.hide();
  });

  document.getElementById('limpiarFormularioBtn')?.addEventListener('click', resetForm);
  document.getElementById('filtroCelda')?.addEventListener('change', updateTable);
  document.getElementById('filtroFecha')?.addEventListener('input', updateTable);

  // ✅ Carga inicial
  updateTable();
});
