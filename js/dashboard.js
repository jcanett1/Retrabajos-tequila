// ─────────────────────────────────────────────
//  Dashboard de Retrabajos – dashboard.js
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {

  // ── Supabase ──────────────────────────────
  const supabaseUrl = 'https://hckbtzbcmijdstyazwoz.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhja2J0emJjbWlqZHN0eWF6d296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MDU4MDcsImV4cCI6MjA2NTA4MTgwN30.JfYJwuytLNXY42QcfjdilP4btvKu17gr84dbUQ_nMBk';
  const { createClient } = supabase;
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  // ── Paleta de colores ─────────────────────
  const COLORS = [
    '#1a73e8','#e37400','#1e8e3e','#d93025','#8430ce',
    '#007b7b','#f29900','#c2185b','#0097a7','#558b2f',
    '#6d4c41','#455a64','#5c6bc0','#ef6c00','#00838f'
  ];

  // ── Instancias de Chart.js ─────────────────
  let charts = {};

  // ── Flatpickr para rango de fechas ─────────
  const esLocale = flatpickr.l10ns.es || flatpickr.l10ns.default;
  flatpickr('#filtroRangoFecha', {
    locale: esLocale,
    mode: 'range',
    dateFormat: 'd/m/Y',
    allowInput: true
  });

  // ── Helpers ───────────────────────────────
  function parseDate(str) {
    if (!str) return null;
    if (str.includes('/')) {
      const [d, m, y] = str.split('/');
      return new Date(y, m - 1, d);
    }
    if (str.includes('-')) {
      const [y, m, d] = str.split('-');
      return new Date(y, m - 1, d);
    }
    return null;
  }

  function getYear(str) {
    const d = parseDate(str);
    return d ? d.getFullYear() : null;
  }

  function getMonthKey(str) {
    const d = parseDate(str);
    if (!d) return null;
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getMonthOrder(str) {
    const d = parseDate(str);
    if (!d) return 0;
    return d.getFullYear() * 100 + (d.getMonth() + 1);
  }

  function countBy(data, key) {
    return data.reduce((acc, item) => {
      const val = item[key] || 'Sin dato';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  function sumBy(data, groupKey, sumKey) {
    return data.reduce((acc, item) => {
      const val = item[groupKey] || 'Sin dato';
      acc[val] = (acc[val] || 0) + (parseInt(item[sumKey]) || 0);
      return acc;
    }, {});
  }

  function topN(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  // ── Cargar datos ──────────────────────────
  async function loadData() {
    const { data, error } = await supabaseClient
      .from('retrabajos')
      .select('*')
      .order('fecha', { ascending: true });

    if (error) {
      console.error('Error al cargar datos:', error);
      return [];
    }
    return data || [];
  }

  // ── Aplicar filtros ───────────────────────
  function applyFilters(data) {
    const anio    = document.getElementById('filtroAnio').value;
    const celda   = document.getElementById('filtroCeldaDash').value;
    const rango   = document.getElementById('filtroRangoFecha').value;

    let filtered = [...data];

    if (anio !== 'todos') {
      filtered = filtered.filter(item => getYear(item.fecha) === parseInt(anio));
    }

    if (celda !== 'todas') {
      filtered = filtered.filter(item => item.celda === celda);
    }

    if (rango) {
      const parts = rango.split(' a ');
      if (parts.length === 2) {
        const start = parseDate(parts[0].trim());
        const end   = parseDate(parts[1].trim());
        if (start && end) {
          filtered = filtered.filter(item => {
            const d = parseDate(item.fecha);
            return d && d >= start && d <= end;
          });
        }
      }
    }

    return filtered;
  }

  // ── KPIs ──────────────────────────────────
  function renderKPIs(data) {
    const total     = data.length;
    const piezas    = data.reduce((s, i) => s + (parseInt(i.cantidad) || 0), 0);

    const porDefecto = countBy(data, 'tipoDefecto');
    const defectoTop = total > 0 ? Object.entries(porDefecto).sort((a,b) => b[1]-a[1])[0]?.[0] : '—';

    const porCelda   = countBy(data, 'celda');
    const celdaTop   = total > 0 ? Object.entries(porCelda).sort((a,b) => b[1]-a[1])[0]?.[0] : '—';

    const porOp      = countBy(data, 'nombreoperador');
    const opTop      = total > 0 ? Object.entries(porOp).sort((a,b) => b[1]-a[1])[0]?.[0] : '—';

    const porMes     = {};
    data.forEach(item => {
      const mk = getMonthKey(item.fecha);
      if (mk) porMes[mk] = (porMes[mk] || 0) + 1;
    });
    const mesTop = total > 0 ? Object.entries(porMes).sort((a,b) => b[1]-a[1])[0]?.[0] : '—';

    document.getElementById('kpiTotal').textContent        = total.toLocaleString();
    document.getElementById('kpiCantidad').textContent     = piezas.toLocaleString();
    document.getElementById('kpiDefectoTop').textContent   = defectoTop ? defectoTop.toUpperCase().slice(0,14) : '—';
    document.getElementById('kpiCeldaTop').textContent     = celdaTop ? `Celda ${celdaTop}` : '—';
    document.getElementById('kpiOperadorTop').textContent  = opTop ? opTop.split(' ')[0] : '—';
    document.getElementById('kpiMesTop').textContent       = mesTop || '—';
  }

  // ── Gráfica: Tendencia mensual ─────────────
  function renderTendencia(data) {
    destroyChart('tendencia');

    const porMes = {};
    data.forEach(item => {
      const mk  = getMonthKey(item.fecha);
      const ord = getMonthOrder(item.fecha);
      if (mk) {
        if (!porMes[mk]) porMes[mk] = { count: 0, order: ord };
        porMes[mk].count++;
      }
    });

    const sorted = Object.entries(porMes)
      .sort((a, b) => a[1].order - b[1].order);

    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => e[1].count);

    const ctx = document.getElementById('chartTendencia').getContext('2d');
    charts['tendencia'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Retrabajos',
          data: values,
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26,115,232,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1a73e8',
          pointRadius: 4,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // ── Gráfica: Por celda (dona) ──────────────
  function renderCelda(data) {
    destroyChart('celda');

    const porCelda = countBy(data, 'celda');
    const entries  = Object.entries(porCelda).sort((a,b) => b[1]-a[1]);

    const ctx = document.getElementById('chartCelda').getContext('2d');
    charts['celda'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => `Celda ${e[0]}`),
        datasets: [{
          data: entries.map(e => e[1]),
          backgroundColor: COLORS.slice(0, entries.length),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, padding: 10 }
          }
        },
        cutout: '60%'
      }
    });
  }

  // ── Gráfica: Por tipo de defecto ───────────
  function renderTipoDefecto(data) {
    destroyChart('tipoDefecto');

    const porTipo = countBy(data, 'tipoDefecto');
    const entries = Object.entries(porTipo).sort((a,b) => b[1]-a[1]);

    const ctx = document.getElementById('chartTipoDefecto').getContext('2d');
    charts['tipoDefecto'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: entries.map(e => e[0].charAt(0).toUpperCase() + e[0].slice(1)),
        datasets: [{
          label: 'Retrabajos',
          data: entries.map(e => e[1]),
          backgroundColor: COLORS.slice(0, entries.length),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // ── Gráfica: Top 10 códigos de defecto ─────
  function renderCodigoDefecto(data) {
    destroyChart('codigoDefecto');

    const porCodigo = countBy(data, 'codigoDefecto');
    const top10     = topN(porCodigo, 10);

    const ctx = document.getElementById('chartCodigoDefecto').getContext('2d');
    charts['codigoDefecto'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(e => e[0].toUpperCase().slice(0, 22)),
        datasets: [{
          label: 'Retrabajos',
          data: top10.map(e => e[1]),
          backgroundColor: 'rgba(132,48,206,0.75)',
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  // ── Gráfica: Por operador ──────────────────
  function renderOperador(data) {
    destroyChart('operador');

    const porOp  = countBy(data, 'nombreoperador');
    const top12  = topN(porOp, 12);

    const ctx = document.getElementById('chartOperador').getContext('2d');
    charts['operador'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top12.map(e => e[0]),
        datasets: [{
          label: 'Retrabajos',
          data: top12.map(e => e[1]),
          backgroundColor: COLORS.slice(0, top12.length).map(c => c + 'cc'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // ── Gráfica: Piezas por celda ──────────────
  function renderPiezasCelda(data) {
    destroyChart('piezasCelda');

    const celdas  = [...new Set(data.map(i => i.celda).filter(Boolean))].sort();
    const meses   = [...new Set(data.map(i => getMonthKey(i.fecha)).filter(Boolean))];
    const mesOrd  = {};
    data.forEach(i => { const mk = getMonthKey(i.fecha); if (mk) mesOrd[mk] = getMonthOrder(i.fecha); });
    const mesesSorted = meses.sort((a,b) => (mesOrd[a]||0) - (mesOrd[b]||0)).slice(-8);

    const datasets = celdas.map((celda, idx) => {
      const values = mesesSorted.map(mes => {
        return data
          .filter(i => i.celda === celda && getMonthKey(i.fecha) === mes)
          .reduce((s, i) => s + (parseInt(i.cantidad) || 0), 0);
      });
      return {
        label: `Celda ${celda}`,
        data: values,
        backgroundColor: COLORS[idx % COLORS.length] + 'bb',
        borderRadius: 4,
        borderSkipped: false
      };
    });

    const ctx = document.getElementById('chartPiezasCelda').getContext('2d');
    charts['piezasCelda'] = new Chart(ctx, {
      type: 'bar',
      data: { labels: mesesSorted, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8 } }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // ── Tabla resumen ─────────────────────────
  function renderTablaResumen(data) {
    const tbody  = document.getElementById('tablaResumenBody');
    const total  = data.length;

    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#6c757d;">Sin datos para mostrar</td></tr>';
      return;
    }

    const porCodigo = {};
    data.forEach(item => {
      const cod = item.codigoDefecto || 'Sin código';
      if (!porCodigo[cod]) porCodigo[cod] = { count: 0, piezas: 0, celdas: {} };
      porCodigo[cod].count++;
      porCodigo[cod].piezas += parseInt(item.cantidad) || 0;
      const c = item.celda || 'N/A';
      porCodigo[cod].celdas[c] = (porCodigo[cod].celdas[c] || 0) + 1;
    });

    const rows = Object.entries(porCodigo)
      .sort((a, b) => b[1].count - a[1].count);

    const maxCount = rows[0]?.[1].count || 1;

    tbody.innerHTML = rows.map(([cod, info], idx) => {
      const celdaTop = Object.entries(info.celdas).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
      const pct      = ((info.count / total) * 100).toFixed(1);
      const barW     = Math.round((info.count / maxCount) * 100);
      return `
        <tr>
          <td style="font-weight:600;color:#6c757d;">${idx + 1}</td>
          <td style="font-weight:600;color:#1a2b45;">${cod.toUpperCase()}</td>
          <td style="font-weight:700;color:#1a73e8;">${info.count.toLocaleString()}</td>
          <td>${info.piezas.toLocaleString()}</td>
          <td><span class="badge-celda">Celda ${celdaTop}</span></td>
          <td style="font-weight:600;">${pct}%</td>
          <td style="min-width:120px;">
            <div class="progress-bar-custom">
              <div class="progress-bar-fill" style="width:${barW}%;"></div>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  // ── Render completo ───────────────────────
  async function renderDashboard() {
    document.getElementById('loadingOverlay').classList.remove('hidden');

    const allData = await loadData();
    const data    = applyFilters(allData);

    renderKPIs(data);
    renderTendencia(data);
    renderCelda(data);
    renderTipoDefecto(data);
    renderCodigoDefecto(data);
    renderOperador(data);
    renderPiezasCelda(data);
    renderTablaResumen(data);

    document.getElementById('ultimaActualizacion').textContent =
      `Última actualización: ${new Date().toLocaleString('es-MX')} — ${data.length} registros`;

    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  // ── Exportar Excel ────────────────────────
  document.getElementById('exportExcelDash').addEventListener('click', async function () {
    const allData = await loadData();
    const data    = applyFilters(allData);

    const rows = data.map(i => ({
      Fecha:           i.fecha,
      Orden:           i.orden,
      'Tipo Defecto':  i.tipoDefecto,
      Celda:           i.celda,
      'Código Defecto':i.codigoDefecto,
      'Parte ID':      i.parteId,
      Cantidad:        i.cantidad,
      Operador:        i.nombreoperador
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Retrabajos');
    XLSX.writeFile(wb, `Retrabajos_Dashboard_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  // ── Exportar PDF ──────────────────────────
  document.getElementById('exportPdfDash').addEventListener('click', async function () {
    const allData = await loadData();
    const data    = applyFilters(allData);

    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Reporte de Retrabajos', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 22);

    const head = [['Fecha','Orden','Tipo Defecto','Celda','Código Defecto','Parte ID','Cantidad','Operador']];
    const body = data.map(i => [
      i.fecha, i.orden, i.tipoDefecto, i.celda,
      i.codigoDefecto, i.parteId, i.cantidad, i.nombreoperador
    ]);

    doc.autoTable({ head, body, startY: 28, styles: { fontSize: 8 } });
    doc.save(`Retrabajos_${new Date().toISOString().slice(0,10)}.pdf`);
  });

  // ── Eventos de filtros ────────────────────
  document.getElementById('btnRefresh').addEventListener('click', renderDashboard);
  document.getElementById('filtroAnio').addEventListener('change', renderDashboard);
  document.getElementById('filtroCeldaDash').addEventListener('change', renderDashboard);
  document.getElementById('filtroRangoFecha').addEventListener('change', renderDashboard);

  // ── Carga inicial ─────────────────────────
  renderDashboard();
});
