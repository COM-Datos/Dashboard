(function () {
  'use strict';

  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const SVG = {
    report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  function optionsHtml(options, selected) {
    return options.map(option => {
      const item = typeof option === 'string' ? { value: option, label: option } : option;
      return `<option value="${escapeHtml(item.value)}"${String(item.value) === String(selected) ? ' selected' : ''}>${escapeHtml(item.label)}</option>`;
    }).join('');
  }

  function choicesHtml(options, selected) {
    const active = new Set((selected || []).map(String));
    return options.map(option => {
      const item = typeof option === 'string' ? { value: option, label: option } : option;
      return `<label class="com-report-choice">
        <input type="checkbox" name="report-section" value="${escapeHtml(item.value)}"${active.has(String(item.value)) ? ' checked' : ''}>
        <span><strong>${escapeHtml(item.label)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span>
      </label>`;
    }).join('');
  }

  function renderMeta(meta) {
    return `<div class="report-meta-grid">${meta.map(item => `
      <div class="report-meta-item">
        <div class="report-meta-label">${escapeHtml(item.label)}</div>
        <div class="report-meta-value">${escapeHtml(item.value)}</div>
      </div>`).join('')}</div>`;
  }

  function renderKpis(items) {
    const columns = Math.max(1, Math.min(items.length, 4));
    return `<div class="report-kpis report-kpis-${columns}">${items.map(item => `
      <div class="report-kpi ${escapeHtml(item.tone || '')}">
        <div class="report-kpi-label">${escapeHtml(item.label)}</div>
        <div class="report-kpi-value">${escapeHtml(item.value)}</div>
        <div class="report-kpi-detail">${escapeHtml(item.detail || '')}</div>
      </div>`).join('')}</div>`;
  }

  function renderTable(section) {
    const aligns = section.aligns || [];
    return `<div class="report-table-wrap"><table class="report-table">
      <thead><tr>${section.columns.map((column, index) => `<th${aligns[index] === 'left' ? ' style="text-align:left"' : ''}>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${section.rows.map(row => `<tr>${row.map((cell, index) => {
        const item = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : { value: cell };
        const cls = item.tone ? ` class="${escapeHtml(item.tone)}"` : '';
        const style = aligns[index] === 'left' ? ' style="text-align:left"' : '';
        return `<td${cls}${style}>${escapeHtml(item.value)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderBars(section) {
    const max = Math.max(1, ...section.items.map(item => Number(item.amount) || 0));
    return `<div class="report-bars">${section.items.map(item => {
      const width = Math.max(1, Math.round((Number(item.amount) || 0) / max * 100));
      return `<div class="report-bar">
        <div class="report-bar-label">${escapeHtml(item.label)}</div>
        <div class="report-bar-track"><div class="report-bar-fill" style="width:${width}%;background:${escapeHtml(item.color || 'var(--report-blue)')}"></div></div>
        <div class="report-bar-value">${escapeHtml(item.value)}</div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderSection(section) {
    let body = '';
    if (section.type === 'kpis') body = renderKpis(section.items || []);
    if (section.type === 'table') body = renderTable(section);
    if (section.type === 'bars') body = renderBars(section);
    if (section.type === 'html') body = section.html || '';
    const pageBreak = section.pageBreak ? ' report-page-break' : '';
    return `<section class="report-section${pageBreak}">
      <div class="report-section-head"><h2>${escapeHtml(section.title)}</h2>${section.note ? `<div class="report-section-note">${escapeHtml(section.note)}</div>` : ''}</div>
      ${body}
      ${section.callout ? `<div class="report-callout ${escapeHtml(section.callout.tone || '')}">${escapeHtml(section.callout.text)}</div>` : ''}
      ${section.criterion ? `<div class="report-criterion"><strong>Criterio:</strong> ${escapeHtml(section.criterion)}</div>` : ''}
    </section>`;
  }

  function renderDocument(model) {
    const intro = model.intro ? `<div class="report-intro">${escapeHtml(model.intro)}</div>` : '';
    const methodology = model.methodology && model.methodology.length ? `
      <section class="report-methodology">
        <strong>Criterios generales</strong>
        <ul>${model.methodology.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>` : '';
    return `<article class="com-report-document">
      <header class="report-doc-head">
        <div>
          <div class="report-doc-brand">Centro Operativo de Montevideo · Informe de gestión</div>
          <h1 class="report-doc-title">${escapeHtml(model.title)}</h1>
          <div class="report-doc-subtitle">${escapeHtml(model.subtitle)}</div>
        </div>
        <div class="report-doc-mark" aria-hidden="true">${escapeHtml(model.mark || 'COM')}</div>
      </header>
      ${renderMeta(model.meta || [])}
      ${intro}
      ${(model.warnings || []).map(w => `<div class="report-callout ${escapeHtml(w.tone || '')}"><strong>${escapeHtml(w.title || 'Nota')}:</strong> ${escapeHtml(w.text)}</div>`).join('')}
      ${(model.sections || []).map(renderSection).join('')}
      ${methodology}
      <footer class="report-doc-footer"><span>COM · ${escapeHtml(model.service || '')}</span><span>${escapeHtml(model.footer || '')}</span></footer>
    </article>`;
  }

  function create(config) {
    if (!config || !config.id || typeof config.generate !== 'function') throw new Error('Configuración de informes incompleta.');
    const id = config.id;
    const multiple = Boolean(config.multiple);
    const typeControl = multiple ? `
      <fieldset class="com-report-fieldset">
        <legend>Contenido del informe</legend>
        <details class="com-report-picker">
          <summary>
            <span class="com-report-picker-copy">
              <strong data-report-selection-summary>Elegí una o más secciones</strong>
              <small>Podés combinar los indicadores que necesites.</small>
            </span>
            <span class="com-report-picker-count" data-report-selection-count>Sin selección</span>
          </summary>
          <div class="com-report-picker-panel">
            <div class="com-report-fieldset-head">
              <span>Secciones disponibles</span>
              <div>
                <button type="button" class="com-report-choice-action" data-report-select-all>Seleccionar todo</button>
                <button type="button" class="com-report-choice-action" data-report-select-none>Limpiar</button>
              </div>
            </div>
            <div class="com-report-choices">${choicesHtml(config.reportTypes || [], config.defaultTypes || [])}</div>
          </div>
        </details>
      </fieldset>` : `
      <div class="com-report-field">
        <label for="${id}-type">Tipo de informe</label>
        <select id="${id}-type">${optionsHtml(config.reportTypes || [], config.defaultType)}</select>
      </div>`;
    const modal = document.createElement('div');
    modal.className = 'com-report-modal';
    modal.id = id + '-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', id + '-title');
    modal.innerHTML = `
      <div class="com-report-shell">
        <aside class="com-report-controls">
          <div class="com-report-controls-head">
            <div class="com-report-kicker">Generador de informes</div>
            <h2 id="${id}-title">${escapeHtml(config.service)}</h2>
            <p>Definí el alcance y generá un documento listo para presentar o analizar.</p>
          </div>
          <form class="com-report-form" id="${id}-form">
            ${typeControl}
            <div class="com-report-dates">
              <div class="com-report-field"><label for="${id}-from">Desde</label><input id="${id}-from" type="date" required></div>
              <div class="com-report-field"><label for="${id}-to">Hasta</label><input id="${id}-to" type="date" required></div>
            </div>
            ${(config.fields || []).map(field => `<div class="com-report-field">
              <label for="${id}-${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>
              <select id="${id}-${escapeHtml(field.id)}">${optionsHtml(field.options || [], field.value)}</select>
              ${field.help ? `<div class="com-report-help">${escapeHtml(field.help)}</div>` : ''}
            </div>`).join('')}
          </form>
          <div class="com-report-controls-actions">
            <p class="com-report-error" id="${id}-error" hidden></p>
            <button class="com-report-button primary" type="submit" form="${id}-form">${SVG.report} Generar vista previa</button>
            <button class="com-report-button" type="button" data-report-close>${SVG.close} Cerrar</button>
          </div>
        </aside>
        <section class="com-report-workspace">
          <div class="com-report-toolbar">
            <div class="com-report-toolbar-title">Vista previa del documento</div>
            <button class="com-report-button" type="button" data-report-print disabled>${SVG.print} Imprimir / Guardar PDF</button>
            <button class="com-report-button" type="button" data-report-close aria-label="Cerrar">${SVG.close}</button>
          </div>
          <div class="com-report-preview" id="${id}-preview">
            <div class="com-report-empty"><div><strong>Prepará el informe</strong>Elegí el contenido, el período y el alcance. La vista previa aparecerá aquí.</div></div>
          </div>
        </section>
      </div>`;
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    const preview = modal.querySelector('.com-report-preview');
    const error = modal.querySelector('.com-report-error');
    const printButton = modal.querySelector('[data-report-print]');
    const picker = modal.querySelector('.com-report-picker');
    const selectionSummary = modal.querySelector('[data-report-selection-summary]');
    const selectionCount = modal.querySelector('[data-report-selection-count]');
    let lastFocus = null;
    let lastHtml = '';
    let lastTitle = '';

    const field = name => modal.querySelector('#' + id + '-' + name);
    const setError = message => {
      error.textContent = message || '';
      error.hidden = !message;
    };

    function updateSelectionSummary() {
      if (!multiple) return;
      const selected = [...modal.querySelectorAll('input[name="report-section"]:checked')];
      const labels = selected.map(input => input.closest('.com-report-choice')?.querySelector('strong')?.textContent || input.value);
      selectionSummary.textContent = selected.length ? labels.join(' · ') : 'Elegí una o más secciones';
      selectionCount.textContent = selected.length ? `${selected.length} ${selected.length === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Sin selección';
    }

    function values() {
      const result = { from: field('from').value, to: field('to').value };
      if (multiple) result.types = [...modal.querySelectorAll('input[name="report-section"]:checked')].map(input => input.value);
      else result.type = field('type').value;
      (config.fields || []).forEach(item => { result[item.id] = field(item.id).value; });
      return result;
    }

    function open(defaults) {
      const resolved = Object.assign({}, typeof config.defaults === 'function' ? config.defaults() : config.defaults, defaults);
      if (resolved.from) field('from').value = resolved.from;
      if (resolved.to) field('to').value = resolved.to;
      if (multiple) {
        const selected = new Set((resolved.types || config.defaultTypes || []).map(String));
        modal.querySelectorAll('input[name="report-section"]').forEach(input => { input.checked = selected.has(input.value); });
        updateSelectionSummary();
        if (picker) picker.open = false;
      } else if (resolved.type && [...field('type').options].some(o => o.value === resolved.type)) {
        field('type').value = resolved.type;
      }
      (config.fields || []).forEach(item => {
        const input = field(item.id);
        if (resolved[item.id] != null && [...input.options].some(o => o.value === String(resolved[item.id]))) input.value = resolved[item.id];
      });
      setError('');
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      (multiple ? picker.querySelector('summary') : field('type')).focus();
    }

    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = values();
      if (!data.from || !data.to) { setError('Seleccioná las fechas Desde y Hasta.'); return; }
      if (data.from > data.to) { setError('La fecha Desde no puede ser posterior a Hasta.'); return; }
      if (multiple && !data.types.length) {
        setError('Seleccioná al menos un contenido para generar el informe.');
        if (picker) picker.open = true;
        picker?.querySelector('summary')?.focus();
        return;
      }
      setError('');
      try {
        const model = config.generate(data);
        if (!model || !Array.isArray(model.sections)) throw new Error('No fue posible construir el informe.');
        lastHtml = renderDocument(model);
        lastTitle = model.title || config.service;
        preview.innerHTML = lastHtml;
        preview.scrollTop = 0;
        printButton.disabled = false;
        if (picker) picker.open = false;
      } catch (err) {
        setError(err && err.message ? err.message : 'No fue posible generar el informe.');
      }
    });

    modal.querySelectorAll('[data-report-close]').forEach(button => button.addEventListener('click', close));
    modal.querySelector('[data-report-select-all]')?.addEventListener('click', () => {
      modal.querySelectorAll('input[name="report-section"]').forEach(input => { input.checked = true; });
      updateSelectionSummary();
      setError('');
    });
    modal.querySelector('[data-report-select-none]')?.addEventListener('click', () => {
      modal.querySelectorAll('input[name="report-section"]').forEach(input => { input.checked = false; });
      updateSelectionSummary();
    });
    modal.querySelectorAll('input[name="report-section"]').forEach(input => input.addEventListener('change', () => {
      updateSelectionSummary();
      setError('');
    }));
    modal.addEventListener('mousedown', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    printButton.addEventListener('click', () => {
      if (!lastHtml) return;
      setError('');
      const previousTitle = document.title;
      document.title = lastTitle;
      window.print();
      document.title = previousTitle;
    });

    return { open, close, values, modal, renderDocument };
  }

  window.COMReports = { create, renderDocument, escapeHtml };
})();
