document.addEventListener('DOMContentLoaded', async function () {
  // ✅ Configuración de Supabase
  const supabaseUrl = 'https://hckbtzbcmijdstyazwoz.supabase.co'; 
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhja2J0emJjbWlqZHN0eWF6d296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU4MDcsImV4cCI6MjA2NTA4MTgwN30.JfYJwuytLNXY42QcfjdilP4btvKu17gr84dbUQ_nMBk';
  const { createClient } = supabase;
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  let selectedPartes = [];
  
  // Variables de paginación
  const ITEMS_PER_PAGE = 25;
  const MODAL_ITEMS_PER_PAGE = 50;
  let paginationState = {
    todos: { currentPage: 1, totalPages: 1, data: [] },
    year2026: { currentPage: 1, totalPages: 1, data: [] },
    anteriores: { currentPage: 1, totalPages: 1, data: [] }
  };
  
  // Variables para paginación del modal
  let modalPaginationState = {
    currentPage: 1,
    totalPages: 1,
    allPartes: [],
    filteredPartes: []
  };

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
  
  function convertirFechaFormatoISO(fechaString) {
    const [dia, mes, año] = fechaString.split('/');
    return `${año}-${mes}-${dia}`;
  }

  // ✅ Función para obtener el año de una fecha en formato dd/mm/yyyy
  function getYearFromDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return parseInt(parts[2]); // El año está en la tercera posición
    }
    // Si la fecha está en formato ISO (yyyy-mm-dd)
    if (dateString.includes('-')) {
      return parseInt(dateString.split('-')[0]);
    }
    return null;
  }

  // ✅ Renderizar partes en el modal con paginación
  function renderModalPartes(partes, page) {
    const container = document.getElementById('partesListContainer');
    const startIndex = (page - 1) * MODAL_ITEMS_PER_PAGE;
    const endIndex = startIndex + MODAL_ITEMS_PER_PAGE;
    const pagePartes = partes.slice(startIndex, endIndex);

    if (pagePartes.length === 0) {
      container.innerHTML = '<div class="alert alert-warning">No hay partes disponibles</div>';
      return;
    }

    const html = pagePartes.map(parte => {
      if (!parte.id || !parte.description) {
        console.warn("Parte con formato incorrecto:", parte);
        return '';
      }
      const isChecked = selectedPartes.includes(parte.id) ? 'checked' : '';
      return `
        <div class="list-group-item parte-item">
          <div class="form-check">
            <input class="form-check-input parte-checkbox" type="checkbox" 
                   value="${parte.id}" id="parte-${parte.id}" ${isChecked}>
            <label class="form-check-label" for="parte-${parte.id}">
              <strong>${parte.id}</strong> - ${parte.description}
            </label>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // ✅ Actualizar información de paginación del modal
  function updateModalPaginationInfo() {
    const totalPages = Math.ceil(modalPaginationState.filteredPartes.length / MODAL_ITEMS_PER_PAGE) || 1;
    const startIndex = (modalPaginationState.currentPage - 1) * MODAL_ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(modalPaginationState.currentPage * MODAL_ITEMS_PER_PAGE, modalPaginationState.filteredPartes.length);

    modalPaginationState.totalPages = totalPages;

    document.getElementById('infoModal').textContent = 
      modalPaginationState.filteredPartes.length > 0 ? `${startIndex}-${endIndex} de ${modalPaginationState.filteredPartes.length} partes` : '0 partes';
    
    document.getElementById('currentPageModal').textContent = modalPaginationState.currentPage;
    document.getElementById('totalPagesModal').textContent = totalPages;

    // Actualizar estado de botones
    const prevBtn = document.getElementById('prevModal');
    const nextBtn = document.getElementById('nextModal');
    
    if (prevBtn) prevBtn.disabled = modalPaginationState.currentPage === 1;
    if (nextBtn) nextBtn.disabled = modalPaginationState.currentPage >= totalPages;
  }

  // ✅ Cargar partes desde JSON
  async function loadPartes() {
    const container = document.getElementById('partesListContainer');
    try {
      const jsonPath = "partesid.json";
      console.log("Intentando cargar JSON desde:", jsonPath);
      const response = await fetch(jsonPath);
      
      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Error HTTP ${response.status}: ${errorDetails}`);
      }
      
      const partes = await response.json();
      console.log("Datos recibidos:", partes);
      
      if (!Array.isArray(partes)) {
        throw new Error("El formato del JSON no es válido. Se esperaba un array.");
      }

      // Guardar todas las partes y resetear paginación
      modalPaginationState.allPartes = partes;
      modalPaginationState.filteredPartes = partes;
      modalPaginationState.currentPage = 1;

      // Renderizar primera página
      renderModalPartes(modalPaginationState.filteredPartes, modalPaginationState.currentPage);
      updateModalPaginationInfo();

      // Configurar filtro en tiempo real (solo una vez)
      const searchInput = document.getElementById('buscarParteInput');
      if (searchInput && !searchInput.dataset.listenerAdded) {
        searchInput.addEventListener('input', filterPartes);
        searchInput.dataset.listenerAdded = 'true';
      }

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
    
    if (text === '') {
      // Si no hay filtro, mostrar todas las partes
      modalPaginationState.filteredPartes = modalPaginationState.allPartes;
    } else {
      // Filtrar partes por texto
      modalPaginationState.filteredPartes = modalPaginationState.allPartes.filter(parte => {
        const searchText = `${parte.id} ${parte.description}`.toLowerCase();
        return searchText.includes(text);
      });
    }
    
    // Resetear a la primera página después de filtrar
    modalPaginationState.currentPage = 1;
    
    // Renderizar resultados filtrados
    renderModalPartes(modalPaginationState.filteredPartes, modalPaginationState.currentPage);
    updateModalPaginationInfo();
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

  // ✅ Renderizar tabla con paginación
  function renderTable(tableId, data, page) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageData = data.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">No hay datos para mostrar</td></tr>`;
    } else {
      tbody.innerHTML = pageData.map(item => `
        <tr>
          <td>${item.fecha}</td>
          <td>${item.orden}</td>
          <td>${item.tipoDefecto}</td>
          <td>${item.celda}</td>
          <td>${item.codigoDefecto}</td>
          <td>${item.parteId}</td>
          <td>${item.cantidad}</td>
          <td>${item.nombreoperador}</td>
        </tr>
      `).join('');
    }
  }

  // ✅ Actualizar información de paginación
  function updatePaginationInfo(tabName, data, currentPage) {
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, data.length);

    document.getElementById(`info${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).textContent = 
      data.length > 0 ? `${startIndex}-${endIndex} de ${data.length} registros` : '0 registros';
    
    document.getElementById(`currentPage${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).textContent = currentPage;
    document.getElementById(`totalPages${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).textContent = totalPages;

    // Actualizar estado de botones
    const prevBtn = document.getElementById(`prev${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const nextBtn = document.getElementById(`next${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  // ✅ Cargar y separar datos por año
  async function updateTable() {
    const { data, error } = await supabaseClient.from('retrabajos').select('*');

    if (error) {
      console.error("Error al cargar datos:", error);
      return;
    }

    // Aplicar filtros
    const filteredData = filterData(data);

    // Separar datos por año
    const data2026 = filteredData.filter(item => getYearFromDate(item.fecha) === 2026);
    const dataAnteriores = filteredData.filter(item => {
      const year = getYearFromDate(item.fecha);
      return year && year < 2026;
    });

    // Actualizar estado de paginación
    paginationState.todos.data = filteredData;
    paginationState.year2026.data = data2026;
    paginationState.anteriores.data = dataAnteriores;

    // Renderizar todas las tablas
    renderTable('retrabajosTableTodos', paginationState.todos.data, paginationState.todos.currentPage);
    renderTable('retrabajosTable2026', paginationState.year2026.data, paginationState.year2026.currentPage);
    renderTable('retrabajosTableAnteriores', paginationState.anteriores.data, paginationState.anteriores.currentPage);

    // Actualizar información de paginación
    updatePaginationInfo('todos', paginationState.todos.data, paginationState.todos.currentPage);
    updatePaginationInfo('2026', paginationState.year2026.data, paginationState.year2026.currentPage);
    updatePaginationInfo('anteriores', paginationState.anteriores.data, paginationState.anteriores.currentPage);
  }

  // ✅ Configurar controles de paginación
  function setupPaginationControls(tabName) {
    const prevBtn = document.getElementById(`prev${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const nextBtn = document.getElementById(`next${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const stateKey = tabName.toLowerCase().replace('2026', 'year2026');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (paginationState[stateKey].currentPage > 1) {
          paginationState[stateKey].currentPage--;
          const tableId = tabName === 'todos' ? 'retrabajosTableTodos' : 
                          tabName === '2026' ? 'retrabajosTable2026' : 'retrabajosTableAnteriores';
          renderTable(tableId, paginationState[stateKey].data, paginationState[stateKey].currentPage);
          updatePaginationInfo(tabName, paginationState[stateKey].data, paginationState[stateKey].currentPage);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(paginationState[stateKey].data.length / ITEMS_PER_PAGE) || 1;
        if (paginationState[stateKey].currentPage < totalPages) {
          paginationState[stateKey].currentPage++;
          const tableId = tabName === 'todos' ? 'retrabajosTableTodos' : 
                          tabName === '2026' ? 'retrabajosTable2026' : 'retrabajosTableAnteriores';
          renderTable(tableId, paginationState[stateKey].data, paginationState[stateKey].currentPage);
          updatePaginationInfo(tabName, paginationState[stateKey].data, paginationState[stateKey].currentPage);
        }
      });
    }
  }

  // ✅ Insertar datos en Supabase
  document.getElementById('retrabajoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateForm()) return;

    const fechaInput = document.getElementById('fechaCreacion').value;
    const fecha = convertirFechaFormatoISO(fechaInput);
    const orden = document.getElementById('numeroOrden').value;
    const tipoDefecto = document.getElementById('tipoDefecto').value;
    const celda = document.getElementById('celda').value;
    const codigoDefecto = document.getElementById('codigoDefecto').value;
    const cantidad = parseInt(document.getElementById('cantidad').value);
    const nombreoperador = document.getElementById('nombreoperador').value;

    for (const parteId of selectedPartes) {
      const nuevoRetrabajo = {
        fecha,
        orden,
        tipoDefecto,
        celda,
        codigoDefecto,
        parteId,
        cantidad,
        nombreoperador
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
    // Obtener la pestaña activa
    const activeTab = document.querySelector('.tab-pane.active');
    const activeTable = activeTab.querySelector('table');
    const wb = XLSX.utils.table_to_book(activeTable, { sheet: "Retrabajos" });
    XLSX.writeFile(wb, `Retrabajos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  document.getElementById('exportPdfBtn').addEventListener('click', function () {
    const doc = new jspdf.jsPDF();
    const activeTab = document.querySelector('.tab-pane.active');
    const activeTable = activeTab.querySelector('table');
    
    const head = [['Fecha', 'Orden', 'Tipo Defecto', 'Celda', 'Código', 'Parte', 'Cantidad', 'Operador']];
    const body = Array.from(activeTable.querySelectorAll('tbody tr')).map(row => {
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

  // Configurar controles de paginación para cada pestaña
  setupPaginationControls('todos');
  setupPaginationControls('2026');
  setupPaginationControls('anteriores');

  // Configurar controles de paginación del modal
  document.getElementById('prevModal')?.addEventListener('click', function() {
    if (modalPaginationState.currentPage > 1) {
      modalPaginationState.currentPage--;
      renderModalPartes(modalPaginationState.filteredPartes, modalPaginationState.currentPage);
      updateModalPaginationInfo();
    }
  });

  document.getElementById('nextModal')?.addEventListener('click', function() {
    if (modalPaginationState.currentPage < modalPaginationState.totalPages) {
      modalPaginationState.currentPage++;
      renderModalPartes(modalPaginationState.filteredPartes, modalPaginationState.currentPage);
      updateModalPaginationInfo();
    }
  });

  // ✅ Carga inicial
  updateTable();
});
