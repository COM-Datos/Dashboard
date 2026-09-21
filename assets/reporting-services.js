(function () {
  'use strict';

  const serviceData = {};
  const COLORS = ['#185FA5','#1D9E75','#EF9F27','#D85A30','#7B5EA7','#2AAFCF','#5E8C31','#888780'];
  const BUTTONS = {
    transportistas: 'btn-reportes-transportistas',
    'zona-limpia': 'btn-reportes-zona-limpia',
    agenda: 'btn-reportes-agenda',
    bolsones: 'btn-reportes-bolsones',
    tareas: 'btn-reportes-tareas'
  };
  const MONTEVIDEO_MUNICIPALITIES = ['A', 'B', 'C', 'CH', 'D', 'E', 'F', 'G'];
  const BUILDERS = {};

  function num(value, decimals = 0) {
    return Number(value || 0).toLocaleString('es-UY', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  function pct(value, total, decimals = 0) {
    return total > 0 ? num(value / total * 100, decimals) + '%' : '—';
  }
  function dateLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
  }
  function periodLabel(options) {
    return options.from === options.to ? dateLabel(options.from) : dateLabel(options.from) + ' — ' + dateLabel(options.to);
  }
  function generatedLabel() {
    return new Intl.DateTimeFormat('es-UY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  }
  function inPeriod(value, from, to) {
    const date = String(value || '').slice(0, 10);
    return Boolean(date && date >= from && date <= to);
  }
  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
  }
  function group(rows, key) {
    const result = {};
    rows.forEach(row => {
      const value = typeof key === 'function' ? key(row) : row[key];
      const label = String(value || 'Sin clasificar');
      (result[label] ||= []).push(row);
    });
    return result;
  }
  function municipalityLabel(value) {
    const text = String(value || '').trim();
    if (!text || text === '?') return 'Sin municipio';
    return /^municipio\b/i.test(text) ? text : 'Municipio ' + text;
  }
  function baseModel(service, title, subtitle, options, meta, sections) {
    return {
      title,
      subtitle,
      service,
      mark: 'COM',
      meta: [{ label: 'Período', value: periodLabel(options) }].concat(meta || []),
      sections,
      footer: 'Generado ' + generatedLabel() + ' · Período ' + periodLabel(options)
    };
  }
  function recreate(id, config) {
    document.getElementById(id + '-modal')?.remove();
    return COMReports.create(config);
  }

  function transportClassifyTask(value) {
    const text = String(value || '').trim();
    if (/bolsones/i.test(text)) return 'BOLSONES';
    if (/agenda/i.test(text)) return 'AGENDA';
    if (/reclamos|enviar tarea/i.test(text) || /^[A-Za-z]+\d+/.test(text)) return 'RECLAMOS';
    return 'TAREAS ESPECIALES';
  }
  function transportStats(rows) {
    const states = {};
    rows.forEach(row => { states[row.Estado] = (states[row.Estado] || 0) + 1; });
    const present = (states['Asistió'] || 0) + (states['Sale tarde'] || 0) + (states['No culmina la jornada'] || 0);
    return { total: rows.length, present, states, attendance: rows.length ? present / rows.length * 100 : 0 };
  }
  function transportRows(options) {
    const data = serviceData.transportistas;
    if (!data?.records?.length) throw new Error('La información todavía no terminó de cargar.');
    return data.records.filter(row =>
      inPeriod(row.Fecha, options.from, options.to) &&
      (options.municipio === 'all' || row.Municipio === options.municipio)
    );
  }
  function buildTransportistas() {
    const data = serviceData.transportistas;
    if (!data?.records?.length) throw new Error('La información todavía no terminó de cargar.');
    const dates = unique(data.records.map(row => row.Fecha));
    const municipalities = MONTEVIDEO_MUNICIPALITIES.filter(value =>
      data.records.some(row => row.Municipio === value)
    );
    const people = unique(data.records.map(row => row.Transportista));
    return recreate('transportistas-report', {
      id: 'transportistas-report',
      service: 'Informes de Transportistas',
      multiple: true,
      defaultTypes: [],
      reportTypes: [
        { value: 'asistencia', label: '% de asistencia', description: 'Resultado global y detalle por municipio.' },
        { value: 'individual', label: 'Asistencia individual', description: 'Resultado y detalle operativo del transportista seleccionado.' },
        { value: 'tareas', label: '% de asistencia por tarea', description: 'Comparación entre los servicios planificados.' }
      ],
      fields: [
        {
          id: 'municipio', label: 'Cobertura', value: 'all',
          options: [{ value: 'all', label: 'Todo Montevideo' }].concat(municipalities.map(value => ({ value, label: municipalityLabel(value) }))),
          help: 'Todo Montevideo incluye el detalle por municipio.'
        },
        {
          id: 'transportista', label: 'Transportista', value: 'all',
          options: [{ value: 'all', label: 'Seleccionar para informe individual' }].concat(people.map(value => ({ value, label: value })))
        }
      ],
      defaults: () => ({
        from: document.getElementById('filterFechaDesde')?.value || dates[0] || '',
        to: document.getElementById('filterFechaHasta')?.value || dates[dates.length - 1] || '',
        municipio: 'all',
        transportista: 'all'
      }),
      generate(options) {
        const selected = new Set(options.types || []);
        let rows = transportRows(options);
        if (!rows.length) throw new Error('No hay registros para el período y alcance seleccionados.');
        const sections = [];
        const scope = options.municipio === 'all' ? 'Todo Montevideo' : municipalityLabel(options.municipio);

        if (selected.has('asistencia')) {
          const stats = transportStats(rows);
          sections.push({
            type: 'kpis', title: 'Asistencia', note: '',
            items: [
              { label: 'Registros planificados', value: num(stats.total), detail: '' },
              { label: 'Asistencias', value: num(stats.present), detail: '', tone: 'teal' },
              { label: '% de asistencia', value: num(stats.attendance, 1) + '%', detail: '', tone: 'teal' }
            ]
          });
          if (options.municipio === 'all') {
            sections.push({
              type: 'table', title: 'Asistencia por municipio', note: '',
              columns: ['Municipio', 'Planificados', 'Asistencias', '% asistencia'],
              aligns: ['left', 'right', 'right', 'right'],
              rows: municipalities.map(name => {
                const list = rows.filter(row => row.Municipio === name);
                const item = transportStats(list);
                return [municipalityLabel(name), num(item.total), num(item.present), { value: num(item.attendance, 1) + '%', tone: 'positive' }];
              })
            });
          }
        }

        if (selected.has('individual')) {
          if (options.transportista === 'all') throw new Error('Seleccioná un transportista para incluir el informe individual.');
          const individual = rows.filter(row => row.Transportista === options.transportista);
          if (!individual.length) throw new Error('El transportista seleccionado no tiene registros en el período.');
          const stats = transportStats(individual);
          sections.push({
            type: 'kpis', title: options.transportista, note: 'Asistencia individual',
            items: [
              { label: 'Jornadas registradas', value: num(stats.total), detail: '' },
              { label: 'Asistencias', value: num(stats.present), detail: '', tone: 'teal' },
              { label: '% de asistencia', value: num(stats.attendance, 1) + '%', detail: '', tone: 'teal' },
              { label: 'Ausencias', value: num(stats.states['No asistió'] || 0), detail: '', tone: 'red' }
            ]
          });
          sections.push({
            type: 'table', title: 'Detalle operativo', note: options.transportista,
            columns: ['Fecha', 'Municipio', 'Tarea', 'Estado', 'Entrada', 'Salida'],
            aligns: ['left', 'left', 'left', 'left', 'right', 'right'],
            rows: individual.slice().sort((a, b) => a.Fecha.localeCompare(b.Fecha)).map(row => [
              dateLabel(row.Fecha), municipalityLabel(row.Municipio), row.Tarea || '—', row.Estado || '—', row.HoraEntrada || '—', row.HoraSalida || '—'
            ])
          });
        }

        if (selected.has('tareas')) {
          const byTask = group(rows, row => transportClassifyTask(row.Tarea));
          sections.push({
            type: 'table', title: 'Asistencia por tarea', note: '',
            columns: ['Tarea', 'Planificados', 'Asistencias', '% asistencia'],
            aligns: ['left', 'right', 'right', 'right'],
            rows: Object.entries(byTask).sort((a, b) => a[0].localeCompare(b[0])).map(([name, list]) => {
              const item = transportStats(list);
              return [name, num(item.total), num(item.present), { value: num(item.attendance, 1) + '%', tone: 'positive' }];
            })
          });
        }

        return baseModel('Transportistas', 'Informe de Transportistas', 'Asistencia y cumplimiento operativo', options, [
          { label: 'Cobertura', value: scope },
          ...(selected.has('individual') ? [{ label: 'Transportista', value: options.transportista }] : [])
        ], sections);
      }
    });
  }
  BUILDERS.transportistas = buildTransportistas;

  function zlRows(options) {
    if (typeof RAW === 'undefined' || !RAW.length) throw new Error('La información todavía no terminó de cargar.');
    const unit = options.unidad === 'all' ? null : options.unidad.split('|||');
    return RAW.filter(row =>
      inPeriod(row.fecha, options.from, options.to) &&
      (options.municipio === 'all' || row.mun === options.municipio) &&
      (options.circuito === 'all' || row.circ === options.circuito) &&
      (options.empresa === 'all' || row.emp === options.empresa) &&
      (!unit || (row.emp === unit[0] && row.trans === unit.slice(1).join('|||')))
    );
  }
  function zlUniqueContainers(rows) {
    return new Set(rows.map(row => row.circ + '|' + row.cont).filter(value => !value.endsWith('|'))).size;
  }
  function buildZonaLimpia() {
    if (typeof RAW === 'undefined' || !RAW.length) throw new Error('La información todavía no terminó de cargar.');
    const dates = unique(RAW.map(row => row.fecha));
    const municipalities = unique(RAW.map(row => row.mun));
    const circuits = unique(RAW.map(row => row.circ));
    const companies = unique(RAW.map(row => row.emp).filter(value => value !== 'Motocarro'));
    const units = unique(RAW.filter(row => row.emp !== 'Motocarro' && row.trans).map(row => row.emp + '|||' + row.trans));
    return recreate('zona-limpia-report', {
      id: 'zona-limpia-report',
      service: 'Informes de Zona Limpia',
      multiple: true,
      defaultTypes: [],
      reportTypes: [
        { value: 'resultados', label: 'Resultados generales', description: 'Visitas y porcentajes globales y por municipio.' },
        { value: 'circuitos', label: 'Detalle por circuito', description: 'Actividad y resultados de cada circuito.' },
        { value: 'empresas', label: 'Empresas y unidades', description: 'Resultado total por empresa o unidad seleccionada.' }
      ],
      fields: [
        {
          id: 'municipio', label: 'Cobertura', value: 'all',
          options: [{ value: 'all', label: 'Todo Montevideo' }].concat(municipalities.map(value => ({ value, label: munLabel(value) })))
        },
        {
          id: 'circuito', label: 'Circuito', value: 'all',
          options: [{ value: 'all', label: 'Todos los circuitos' }].concat(circuits.map(value => ({ value, label: value })))
        },
        {
          id: 'empresa', label: 'Empresa', value: 'all',
          options: [{ value: 'all', label: 'Todas las empresas' }].concat(companies.map(value => ({ value, label: value })))
        },
        {
          id: 'unidad', label: 'Unidad', value: 'all',
          options: [{ value: 'all', label: 'Todas las unidades' }].concat(units.map(value => {
            const parts = value.split('|||');
            return { value, label: parts[0] + ' — ' + parts.slice(1).join('|||') };
          }))
        }
      ],
      defaults: () => ({
        from: document.getElementById('f-d1')?.value || dates[0] || '',
        to: document.getElementById('f-d2')?.value || dates[dates.length - 1] || '',
        municipio: 'all', circuito: 'all', empresa: 'all', unidad: 'all'
      }),
      generate(options) {
        const selected = new Set(options.types || []);
        const rows = zlRows(options);
        if (!rows.length) throw new Error('No hay visitas para el período y alcance seleccionados.');
        const sections = [];
        const scope = options.municipio === 'all' ? 'Todo Montevideo' : munLabel(options.municipio);

        if (selected.has('resultados')) {
          const stats = st(rows);
          sections.push({
            type: 'kpis', title: 'Resultados generales', note: '',
            items: [
              { label: 'Contenedores visitados', value: num(zlUniqueContainers(rows)), detail: num(stats.total) + ' visitas registradas' },
              { label: 'Intervino', value: num(stats.pi) + '%', detail: num(stats.n.intervino) + ' visitas', tone: 'teal' },
              { label: 'Ya limpio', value: num(stats.pl) + '%', detail: num(stats.n.limpio) + ' visitas' },
              { label: 'No pudo/encontró', value: num(stats.pn) + '%', detail: num(stats.n.no_fue) + ' visitas', tone: 'red' }
            ]
          });
          if (options.municipio === 'all') {
            sections.push({
              type: 'table', title: 'Resultados por municipio', note: '',
              columns: ['Municipio', 'Contenedores', 'Visitas', 'Intervino', 'Ya limpio', 'No pudo'],
              aligns: ['left', 'right', 'right', 'right', 'right', 'right'],
              rows: Object.entries(group(rows, 'mun')).map(([name, list]) => {
                const item = st(list);
                return [munLabel(name), num(zlUniqueContainers(list)), num(item.total), num(item.pi) + '%', num(item.pl) + '%', num(item.pn) + '%'];
              })
            });
          }
        }

        if (selected.has('circuitos')) {
          sections.push({
            type: 'table', title: 'Detalle por circuito', note: '',
            columns: ['Circuito', 'Contenedores', 'Visitas', 'Prom./día', 'Intervino', 'Ya limpio', 'No pudo'],
            aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
            rows: Object.entries(group(rows, 'circ')).filter(([name]) => name !== 'Sin clasificar').map(([name, list]) => {
              const item = st(list);
              return [name, num(zlUniqueContainers(list)), num(item.total), num(item.prom, 1), num(item.pi) + '%', num(item.pl) + '%', num(item.pn) + '%'];
            })
          });
        }

        if (selected.has('empresas')) {
          const companyRows = rows.filter(row => row.emp !== 'Motocarro');
          if (!companyRows.length) throw new Error('No hay datos de empresas para el alcance seleccionado.');
          const byUnit = options.empresa !== 'all' || options.unidad !== 'all';
          sections.push({
            type: 'table', title: byUnit ? 'Resultados por unidad' : 'Resultados por empresa', note: '',
            columns: [byUnit ? 'Unidad' : 'Empresa', 'Visitas', 'Prom./día', 'Intervino', 'Ya limpio', 'No pudo'],
            aligns: ['left', 'right', 'right', 'right', 'right', 'right'],
            rows: Object.entries(group(companyRows, byUnit ? 'trans' : 'emp')).map(([name, list]) => {
              const item = st(list);
              return [name, num(item.total), num(item.prom, 1), num(item.pi) + '%', num(item.pl) + '%', num(item.pn) + '%'];
            })
          });
        }

        const companyScope = options.unidad !== 'all'
          ? options.unidad.split('|||').slice(1).join('|||')
          : (options.empresa === 'all' ? 'Todas' : options.empresa);
        return baseModel('Zona Limpia', 'Informe de Zona Limpia', 'Cobertura y resultados operativos', options, [
          { label: 'Cobertura', value: scope },
          { label: 'Circuito', value: options.circuito === 'all' ? 'Todos' : options.circuito },
          { label: 'Empresa / unidad', value: companyScope }
        ], sections);
      }
    });
  }
  BUILDERS['zona-limpia'] = buildZonaLimpia;

  function agendaAttention(options, municipality) {
    const rows = DATOS.reclamos.filter(row => {
      if (!esServicio(row)) return false;
      const agendaDate = String(row.fecha_de_agenda || '').slice(0, 10);
      return inPeriod(agendaDate, options.from, options.to) &&
        (municipality === 'todos' || String(row.municipio || '').trim() === municipality);
    });
    const values = rows.map(row => {
      const start = String(row.fecha_de_reclamo || '').slice(0, 10);
      const end = String(row.fecha_de_agenda || '').slice(0, 10);
      if (!start || !end) return null;
      const days = Math.round((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000);
      return days >= 0 ? days : null;
    }).filter(value => value !== null);
    return { count: values.length, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  }
  function agendaTotals(options, municipality) {
    const enteredDays = ingresosPorDia(options.from, options.to, municipality);
    const completedDays = serviciosPorDia(options.from, options.to, municipality);
    const entered = enteredDays.reduce((sum, day) => sum + (day.v.total || 0), 0);
    const completed = completedDays.reduce((sum, day) => sum + (day.v.total || 0), 0);
    return {
      enteredDays, completedDays, entered, completed,
      completedAverage: promedioPorDia(completed, completedDays, municipality)
    };
  }
  function buildAgenda() {
    if (typeof DATOS === 'undefined' || !DATOS.reclamos?.length) throw new Error('La información todavía no terminó de cargar.');
    const municipalities = CONFIG.municipios.map(item => item.muni);
    return recreate('agenda-report', {
      id: 'agenda-report',
      service: 'Informes de Agenda',
      multiple: true,
      defaultTypes: [],
      reportTypes: [
        { value: 'actividad', label: 'Ingresadas y realizadas', description: 'Totales globales y detalle por municipio.' },
        { value: 'atencion', label: 'Promedio de días de atención', description: 'Resultado del período por municipio.' },
        { value: 'promedio', label: 'Promedio de agendas por día', description: 'Agendas realizadas por jornada.' },
        { value: 'camiones', label: 'Turnos de camión utilizados', description: 'Total y promedio diario.' },
        { value: 'descargas', label: 'Descargas', description: 'Promedio diario y distribución por lugar.' }
      ],
      fields: [{
        id: 'municipio', label: 'Cobertura', value: 'todos',
        options: [{ value: 'todos', label: 'Todo Montevideo' }].concat(municipalities.map(value => ({ value, label: municipalityLabel(value) }))),
        help: 'Todo Montevideo incluye el detalle por municipio.'
      }],
      defaults: () => ({
        from: document.getElementById('f-desde')?.value || DATOS.cobertura.ingresados?.desde || '',
        to: document.getElementById('f-hasta')?.value || DATOS.cobertura.ingresados?.hasta || '',
        municipio: 'todos'
      }),
      generate(options) {
        const selected = new Set(options.types || []);
        const scope = options.municipio === 'todos' ? 'Todo Montevideo' : municipalityLabel(options.municipio);
        const totals = agendaTotals(options, options.municipio);
        const sections = [];
        if (!totals.entered && !totals.completed && !selected.has('descargas')) {
          throw new Error('No hay agendas para el período y alcance seleccionados.');
        }

        if (selected.has('actividad')) {
          sections.push({
            type: 'kpis', title: 'Ingresadas y realizadas', note: '',
            items: [
              { label: 'Solicitudes ingresadas', value: num(totals.entered), detail: '' },
              { label: 'Agendas realizadas', value: num(totals.completed), detail: '', tone: 'teal' }
            ]
          });
          if (options.municipio === 'todos') {
            sections.push({
              type: 'table', title: 'Actividad por municipio', note: '',
              columns: ['Municipio', 'Ingresadas', 'Realizadas'],
              aligns: ['left', 'right', 'right'],
              rows: municipalities.map(municipality => {
                const item = agendaTotals(options, municipality);
                return [municipalityLabel(municipality), num(item.entered), num(item.completed)];
              })
            });
          }
        }

        if (selected.has('atencion')) {
          if (options.municipio === 'todos') {
            sections.push({
              type: 'table', title: 'Promedio de días de atención', note: '',
              columns: ['Municipio', 'Agendas', 'Promedio'],
              aligns: ['left', 'right', 'right'],
              rows: municipalities.map(municipality => {
                const item = agendaAttention(options, municipality);
                return [municipalityLabel(municipality), num(item.count), item.average === null ? '—' : num(item.average, 1) + ' días'];
              })
            });
          } else {
            const item = agendaAttention(options, options.municipio);
            sections.push({
              type: 'kpis', title: 'Promedio de días de atención', note: scope,
              items: [{ label: 'Promedio', value: item.average === null ? '—' : num(item.average, 1) + ' días', detail: num(item.count) + ' agendas' }]
            });
          }
        }

        if (selected.has('promedio')) {
          sections.push({
            type: 'kpis', title: 'Promedio de agendas realizadas por día', note: '',
            items: [{ label: 'Agendas por día', value: num(totals.completedAverage, 1), detail: num(totals.completed) + ' realizadas', tone: 'teal' }]
          });
        }

        if (selected.has('camiones')) {
          const days = turnosPorDia(options.from, options.to, options.municipio);
          const total = days.reduce((sum, day) => sum + (day.v.camion || 0), 0);
          const average = promedioPorDia(total, days, options.municipio);
          sections.push({
            type: 'kpis', title: 'Turnos de camión utilizados', note: '',
            items: [
              { label: 'Turnos utilizados', value: num(total), detail: '' },
              { label: 'Promedio por día', value: num(average, 1), detail: '', tone: 'teal' }
            ]
          });
        }

        if (selected.has('descargas')) {
          const days = descargasPorDia(options.from, options.to);
          const series = seriesDescargas(days);
          const totalsByPlace = series.map(item => ({
            label: item.label,
            color: item.color,
            count: days.reduce((sum, day) => sum + (day.v[item.key] || 0), 0)
          }));
          const total = totalsByPlace.reduce((sum, item) => sum + item.count, 0);
          const average = promedioPorDia(total, days);
          sections.push({
            type: 'kpis', title: 'Descargas', note: 'Registro global',
            items: [
              { label: 'Descargas registradas', value: num(total), detail: '' },
              { label: 'Promedio por día', value: num(average, 1), detail: '', tone: 'teal' }
            ]
          });
          sections.push({
            type: 'bars', title: 'Distribución por lugar de descarga', note: '',
            items: totalsByPlace.filter(item => item.count).map(item => ({
              label: item.label,
              amount: item.count,
              value: num(item.count) + ' · ' + pct(item.count, total, 0),
              color: item.color
            }))
          });
        }

        return baseModel('Agenda', 'Informe de Agenda', 'Actividad y recursos del servicio', options, [
          { label: 'Cobertura', value: scope }
        ], sections);
      }
    });
  }
  BUILDERS.agenda = buildAgenda;
  function bolsonesTotals(options, municipality) {
    const requestDays = solicitudesPorDia(options.from, options.to, municipality);
    const serviceDays = serviciosPorDia(options.from, options.to, municipality);
    const bagDays = bolsonesPorDia(options.from, options.to, municipality);
    const entered = requestDays.reduce((sum, day) => sum + day.total, 0);
    const completed = serviceDays.reduce((sum, day) => sum + day.total, 0);
    const large = bagDays.reduce((sum, day) => sum + (day.grande || 0), 0);
    const small = bagDays.reduce((sum, day) => sum + (day.chico || 0), 0);
    return {
      entered, completed, large, small, bags: large + small,
      bagAverage: bagDays.length ? (large + small) / bagDays.length : 0
    };
  }
  function buildBolsones() {
    if (typeof REGISTROS === 'undefined' || !REGISTROS.length) throw new Error('La información todavía no terminó de cargar.');
    const municipalities = Object.keys(CONFIG.diasIntervencion);
    const available = obtenerPeriodoDisponible(REGISTROS);
    return recreate('bolsones-report', {
      id: 'bolsones-report',
      service: 'Informes de Bolsones',
      multiple: true,
      defaultTypes: [],
      reportTypes: [
        { value: 'solicitudes', label: 'Solicitudes ingresadas y realizadas', description: 'Totales globales y detalle por municipio.' },
        { value: 'bolsones', label: 'Bolsones realizados', description: 'Totales, promedio diario, grandes y chicos.' },
        { value: 'camiones', label: 'Turnos de camión utilizados', description: 'Total y promedio diario.' },
        { value: 'plantas', label: 'Kilos descargados', description: 'Total y distribución por planta.' }
      ],
      fields: [{
        id: 'municipio', label: 'Cobertura', value: 'todos',
        options: [{ value: 'todos', label: 'Todo Montevideo' }].concat(municipalities.map(value => ({ value, label: municipalityLabel(value) }))),
        help: 'Todo Montevideo incluye el detalle por municipio.'
      }],
      defaults: () => ({
        from: document.getElementById('f-desde')?.value || available?.desde || '',
        to: document.getElementById('f-hasta')?.value || available?.hasta || '',
        municipio: 'todos'
      }),
      generate(options) {
        const selected = new Set(options.types || []);
        const scope = options.municipio === 'todos' ? 'Todo Montevideo' : municipalityLabel(options.municipio);
        const totals = bolsonesTotals(options, options.municipio);
        const sections = [];
        if (!totals.entered && !totals.completed && !totals.bags && !selected.has('plantas')) {
          throw new Error('No hay registros para el período y alcance seleccionados.');
        }

        if (selected.has('solicitudes')) {
          sections.push({
            type: 'kpis', title: 'Solicitudes ingresadas y realizadas', note: '',
            items: [
              { label: 'Solicitudes ingresadas', value: num(totals.entered), detail: '' },
              { label: 'Solicitudes realizadas', value: num(totals.completed), detail: '', tone: 'teal' }
            ]
          });
          if (options.municipio === 'todos') {
            sections.push({
              type: 'table', title: 'Solicitudes por municipio', note: '',
              columns: ['Municipio', 'Ingresadas', 'Realizadas'],
              aligns: ['left', 'right', 'right'],
              rows: municipalities.map(municipality => {
                const item = bolsonesTotals(options, municipality);
                return [municipalityLabel(municipality), num(item.entered), num(item.completed)];
              })
            });
          }
        }

        if (selected.has('bolsones')) {
          sections.push({
            type: 'kpis', title: 'Bolsones realizados', note: '',
            items: [
              { label: 'Total', value: num(totals.bags), detail: '' },
              { label: 'Grandes', value: num(totals.large), detail: '' },
              { label: 'Chicos', value: num(totals.small), detail: '' },
              { label: 'Promedio por día', value: num(totals.bagAverage, 1), detail: '', tone: 'teal' }
            ]
          });
          if (options.municipio === 'todos') {
            sections.push({
              type: 'table', title: 'Bolsones por municipio', note: '',
              columns: ['Municipio', 'Total', 'Grandes', 'Chicos', 'Prom./día'],
              aligns: ['left', 'right', 'right', 'right', 'right'],
              rows: municipalities.map(municipality => {
                const item = bolsonesTotals(options, municipality);
                return [municipalityLabel(municipality), num(item.bags), num(item.large), num(item.small), num(item.bagAverage, 1)];
              })
            });
          }
        }

        if (selected.has('camiones')) {
          const days = turnosPorDia(options.from, options.to, options.municipio);
          const total = days.reduce((sum, day) => sum + (day.camion || 0), 0);
          const average = promedioTurnosCamion(total, days, options.municipio);
          sections.push({
            type: 'kpis', title: 'Turnos de camión utilizados', note: '',
            items: [
              { label: 'Turnos utilizados', value: num(total), detail: '' },
              { label: 'Promedio por día', value: num(average, 1), detail: '', tone: 'teal' }
            ]
          });
        }

        if (selected.has('plantas')) {
          const days = kilosPorPlantaYDia(options.from, options.to, options.municipio);
          const plants = CONFIG.plantas.map(plant => ({
            label: plant.nombre,
            color: plant.color,
            kilos: days.reduce((sum, day) => sum + (day[plant.key] || 0), 0)
          }));
          const total = plants.reduce((sum, plant) => sum + plant.kilos, 0);
          sections.push({
            type: 'kpis', title: 'Kilos descargados', note: '',
            items: [{ label: 'Total descargado', value: num(total) + ' kg', detail: '' }]
          });
          sections.push({
            type: 'bars', title: 'Distribución por planta', note: '',
            items: plants.filter(plant => plant.kilos).map(plant => ({
              label: plant.label,
              amount: plant.kilos,
              value: num(plant.kilos) + ' kg · ' + pct(plant.kilos, total, 0),
              color: plant.color
            }))
          });
        }

        return baseModel('Bolsones', 'Informe de Bolsones', 'Solicitudes, recursos y descargas', options, [
          { label: 'Cobertura', value: scope }
        ], sections);
      }
    });
  }
  BUILDERS.bolsones = buildBolsones;
  function dayCount(from, to) {
    const start = new Date(from + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
    return Math.round((end - start) / 86400000) + 1;
  }
  function tareasRows(options) {
    if (typeof macroHist === 'undefined') throw new Error('La información todavía no terminó de cargar.');
    return macroHist.filter(row =>
      inPeriod(row.date, options.from, options.to) &&
      (options.municipio === 'all' || row.muni === options.municipio)
    );
  }
  function buildTareas() {
    if (typeof macroHist === 'undefined' || typeof plan === 'undefined') throw new Error('La información todavía no terminó de cargar.');
    const municipalities = unique(macroHist.map(row => row.muni).concat(plan.map(row => row.muni)));
    const visibleWeek = dates();
    const weekFrom = ymd(visibleWeek[0]);
    const weekTo = ymd(visibleWeek[visibleWeek.length - 1]);
    return recreate('tareas-report', {
      id: 'tareas-report',
      service: 'Informes de Tareas Especiales',
      multiple: true,
      defaultTypes: [],
      reportTypes: [
        { value: 'horas', label: 'Horas por tipo de tarea', description: 'Promedio diario de horas-motocarro.' },
        { value: 'recursos', label: 'Recursos utilizados', description: 'Promedio diario de motocarros y camiones.' },
        { value: 'planificacion', label: 'Planificación semanal', description: 'Detalle de la semana visible en el dashboard.' }
      ],
      fields: [{
        id: 'municipio', label: 'Cobertura', value: 'all',
        options: [{ value: 'all', label: 'Todo Montevideo' }].concat(municipalities.map(value => ({ value, label: municipalityLabel(value) })))
      }],
      defaults: () => ({
        from: macroFrom || document.getElementById('ffrom')?.value || '',
        to: macroTo || document.getElementById('fto')?.value || '',
        municipio: 'all'
      }),
      generate(options) {
        const selected = new Set(options.types || []);
        const rows = tareasRows(options);
        const needsHistory = selected.has('horas') || selected.has('recursos');
        if (needsHistory && !rows.length) throw new Error('No hay tareas ejecutadas para el período y alcance seleccionados.');
        const days = Math.max(1, dayCount(options.from, options.to));
        const completed = rows.filter(row => stateClass(row.state) === 'done');
        const sections = [];

        if (selected.has('horas')) {
          const byTask = {};
          completed.forEach(row => {
            const minutes = validDurationMinutes(row);
            const vehicles = vehicleCount(row, 'moto');
            if (minutes === null || !vehicles) return;
            const key = taskType(row);
            byTask[key] = (byTask[key] || 0) + minutes * vehicles;
          });
          sections.push({
            type: 'bars', title: 'Horas promedio por día y tipo de tarea', note: '',
            items: Object.entries(byTask).sort((a, b) => b[1] - a[1]).map(([label, minutes], index) => ({
              label,
              amount: minutes / 60 / days,
              value: num(minutes / 60 / days, 1) + ' h/día',
              color: COLORS[index % COLORS.length]
            }))
          });
        }

        if (selected.has('recursos')) {
          const motorbikes = completed.reduce((sum, row) => sum + vehicleCount(row, 'moto'), 0);
          const trucks = completed.reduce((sum, row) => sum + vehicleCount(row, 'truck'), 0);
          sections.push({
            type: 'kpis', title: 'Recursos utilizados', note: '',
            items: [
              { label: 'Motocarros promedio por día', value: num(motorbikes / days, 1), detail: '' },
              { label: 'Camiones promedio por día', value: num(trucks / days, 1), detail: '', tone: 'teal' }
            ]
          });
        }

        if (selected.has('planificacion')) {
          const plannedRows = [];
          visibleWeek.forEach((date, index) => {
            const dayName = DAYS[index];
            plan.filter(item => item.days.toUpperCase().split(',').map(value => value.trim()).includes(dayName))
              .filter(item => options.municipio === 'all' || item.muni === options.municipio)
              .forEach(item => plannedRows.push({ date, dayName, item }));
          });
          const resources = totals(plannedRows.map(row => row.item));
          sections.push({
            type: 'kpis', title: 'Planificación semanal', note: dateLabel(weekFrom) + ' — ' + dateLabel(weekTo),
            items: [
              { label: 'Tareas planificadas', value: num(plannedRows.length), detail: '' },
              { label: 'Motocarros', value: num(resources.moto), detail: '' },
              { label: 'Camiones', value: num(resources.truck), detail: '', tone: 'teal' }
            ]
          });
          sections.push({
            type: 'table', title: 'Detalle de la planificación', note: '',
            columns: ['Fecha', 'Hora', 'Municipio', 'Tarea', 'Recurso'],
            aligns: ['left', 'right', 'left', 'left', 'left'],
            rows: plannedRows.map(row => [
              dateLabel(ymd(row.date)), row.item.time || '—', municipalityLabel(row.item.muni),
              row.item.task || '—', row.item.resource || '—'
            ])
          });
        }

        return baseModel('Tareas Especiales', 'Informe de Tareas Especiales', 'Ejecución y planificación operativa', options, [
          { label: 'Cobertura', value: options.municipio === 'all' ? 'Todo Montevideo' : municipalityLabel(options.municipio) },
          ...(selected.has('planificacion') ? [{ label: 'Semana planificada', value: dateLabel(weekFrom) + ' — ' + dateLabel(weekTo) }] : [])
        ], sections);
      }
    });
  }
  BUILDERS.tareas = buildTareas;

  function open(service) {
    if (!window.COMReports || !BUILDERS[service]) return;
    try {
      BUILDERS[service]().open();
    } catch (error) {
      console.error('No se pudo abrir el generador de informes:', error);
    }
  }
  function enable(service, data) {
    if (data) serviceData[service] = data;
    const button = document.getElementById(BUTTONS[service]);
    if (button) button.disabled = false;
  }
  function disable(service) {
    const button = document.getElementById(BUTTONS[service]);
    if (button) button.disabled = true;
  }

  window.COMServiceReports = { open, enable, disable, setData(service, data) { serviceData[service] = data; } };
})();
