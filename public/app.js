// ============================================================
// CleanSweep Dev v2 - Frontend Logic (Premium Edition)
// Features: Filters, Individual Delete, Inactive Badge,
//           Segment Chart, Historical Savings (localStorage)
// ============================================================

// State Management
let currentScanPath = '';
let selectedFolders = new Set();
let scannedProjects = [];
let browserCurrentPath = '';
let activeFolderInBrowser = '';
let totalFreedToday = 0;
let activeTechFilter = 'all';
let activeSizeFilter = 'all';

// Pending single-row delete state
let pendingDeletePath = null;
let pendingDeleteSize = 0;

// System Cleanup State
let systemTargets = [];
let activeView = 'projects'; // 'projects' or 'system'

// ── DOM Elements Cache ────────────────────────────────────────
// Tabs & Views
const tabProjects        = document.getElementById('tabProjects');
const tabSystem          = document.getElementById('tabSystem');
const tabLargeFiles      = document.getElementById('tabLargeFiles');
const viewProjects       = document.getElementById('viewProjects');
const viewSystem         = document.getElementById('viewSystem');
const viewLargeFiles     = document.getElementById('viewLargeFiles');

// System Cleanup Elements
const btnScanSystem      = document.getElementById('btnScanSystem');
const systemScanLoader   = document.getElementById('systemScanLoader');
const systemResultsPanel = document.getElementById('systemResultsPanel');
const systemTableBody    = document.getElementById('systemTableBody');
const scanPathInput      = document.getElementById('scanPath');
const btnBrowse          = document.getElementById('btnBrowse');
const btnScan            = document.getElementById('btnScan');
const emptyState         = document.getElementById('emptyState');
const resultsPanel       = document.getElementById('resultsPanel');
const projectAccordionList = document.getElementById('projectAccordionList');
const scanLoader         = document.getElementById('scanLoader');
const scanningCurrentPath= document.getElementById('scanningCurrentPath');

// Large Files Elements
const scanLargePathInput = document.getElementById('scanLargePath');
const btnBrowseLarge     = document.getElementById('btnBrowseLarge');
const btnScanLarge       = document.getElementById('btnScanLarge');
const largeFilesTable    = document.getElementById('largeFilesTable');
const largeFilesBody     = document.getElementById('largeFilesBody');
const checkAllLargeFiles = document.getElementById('checkAllLargeFiles');

// Settings Modal
const modalSettings      = document.getElementById('modalSettings');
const btnSettings        = document.getElementById('btnSettings');
const btnCloseSettings   = document.getElementById('btnCloseSettings');
const btnCancelSettings  = document.getElementById('btnCancelSettings');
const whitelistInput     = document.getElementById('whitelistInput');
const btnWhitelistBrowse = document.getElementById('btnWhitelistBrowse');
const btnAddWhitelist    = document.getElementById('btnAddWhitelist');
const whitelistList      = document.getElementById('whitelistList');

// Stats
const statRecoverable  = document.getElementById('statRecoverable');
const statProjects     = document.getElementById('statProjects');
const statFreed        = document.getElementById('statFreed');
const statTotalFreed   = document.getElementById('statTotalFreed');

// Space chart
const spaceChartSection = document.getElementById('spaceChartSection');
const segmentBar        = document.getElementById('segmentBar');
const segmentLegend     = document.getElementById('segmentLegend');

// Filters
const techFiltersEl  = document.getElementById('techFilters');
const sizeFiltersEl  = document.getElementById('sizeFilters');

// Action Bar
const actionBar         = document.getElementById('actionBar');
const selectionCountText= document.getElementById('selectionCount');
const selectionSizeText = document.getElementById('selectionSize');
const btnCleanSelected  = document.getElementById('btnCleanSelected');
const btnSelectAllGlobal= document.getElementById('btnSelectAllGlobal');
const btnDeselectAllGlobal = document.getElementById('btnDeselectAllGlobal');

// File Browser Modal
const modalBrowse        = document.getElementById('modalBrowse');
const btnCloseBrowse     = document.getElementById('btnCloseBrowse');
const btnCancelBrowse    = document.getElementById('btnCancelBrowse');
const btnSelectActiveFolder = document.getElementById('btnSelectActiveFolder');
const btnBrowseUp        = document.getElementById('btnBrowseUp');
const browserCurrentPathText = document.getElementById('browserCurrentPath');
const browserList        = document.getElementById('browserList');

// Confirm Modal
const modalConfirm     = document.getElementById('modalConfirm');
const confirmList      = document.getElementById('confirmList');
const executablesWarning = document.getElementById('executablesWarning');
const btnCloseConfirm  = document.getElementById('btnCloseConfirm');
const btnCancelConfirm = document.getElementById('btnCancelConfirm');
const btnExecuteConfirm= document.getElementById('btnExecuteConfirm');

// Progress Modal
const modalProgress    = document.getElementById('modalProgress');
const progressBarFill  = document.getElementById('progressBarFill');
const deletionLog      = document.getElementById('deletionLog');
const progressTitle    = document.getElementById('progressTitle');
const progressSubtitle = document.getElementById('progressSubtitle');
const btnFinishProgress= document.getElementById('btnFinishProgress');
const progressActionRow= document.getElementById('progressActionRow');

// Quick paths
const quickHome      = document.getElementById('quickHome');
const quickDownloads = document.getElementById('quickDownloads');
const quickDocuments = document.getElementById('quickDocuments');

// ── Tech color map ────────────────────────────────────────────
const TECH_COLORS = {
  'node': { cls: 'color-node', label: 'Node.js' },
  'python': { cls: 'color-python', label: 'Python' },
  'rust': { cls: 'color-rust', label: 'Rust' },
  'net': { cls: 'color-net', label: 'C# / .NET' },
  'java': { cls: 'color-java', label: 'Java' },
  'other': { cls: 'color-other', label: 'Otros' },
};

// ── Helpers ───────────────────────────────────────────────────
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFolderSizeByPath(folderPath) {
  for (const project of scannedProjects) {
    for (const folder of project.folders) {
      if (folder.path === folderPath) return folder.size;
    }
  }
  return 0;
}

function getTechKey(typeLower) {
  if (typeLower.includes('node')) return 'node';
  if (typeLower.includes('python')) return 'python';
  if (typeLower.includes('rust')) return 'rust';
  if (typeLower.includes('c#') || typeLower.includes('.net')) return 'net';
  if (typeLower.includes('java') || typeLower.includes('gradle')) return 'java';
  return 'other';
}

function getBadgeClass(techKey) {
  const map = { node: 'badge-node', python: 'badge-python', rust: 'badge-rust', net: 'badge-net', java: 'badge-java', other: 'badge-git' };
  return map[techKey] || 'badge-git';
}

function isInactive(lastModified) {
  const diffMs = Date.now() - new Date(lastModified).getTime();
  return diffMs > 30 * 24 * 60 * 60 * 1000; // 30 days
}

// ── localStorage helpers ──────────────────────────────────────
function loadHistoricalFreed() {
  return parseInt(localStorage.getItem('cs_total_freed') || '0', 10);
}

function saveHistoricalFreed(bytes) {
  const current = loadHistoricalFreed();
  localStorage.setItem('cs_total_freed', current + bytes);
  statTotalFreed.textContent = formatBytes(current + bytes);
}

// ── Init ──────────────────────────────────────────────────────
async function initDefaults() {
  // Restore historical savings
  statTotalFreed.textContent = formatBytes(loadHistoricalFreed());

  try {
    const res = await fetch('/api/browse');
    const data = await res.json();
    if (data.success) scanPathInput.value = data.currentPath;
  } catch (e) {
    console.error('Error fetching home path:', e);
  }
}

// ── Segment Chart ─────────────────────────────────────────────
function renderSpaceChart(projects) {
  const techTotals = {};
  let grandTotal = 0;

  projects.forEach(project => {
    const key = getTechKey(project.type.toLowerCase());
    project.folders.forEach(folder => {
      techTotals[key] = (techTotals[key] || 0) + folder.size;
      grandTotal += folder.size;
    });
  });

  if (grandTotal === 0) {
    spaceChartSection.classList.add('hidden');
    return;
  }

  segmentBar.innerHTML = '';
  segmentLegend.innerHTML = '';

  Object.entries(techTotals).sort((a, b) => b[1] - a[1]).forEach(([key, size]) => {
    const pct = ((size / grandTotal) * 100).toFixed(1);
    const info = TECH_COLORS[key] || TECH_COLORS['other'];

    const seg = document.createElement('div');
    seg.className = `segment ${info.cls}`;
    seg.style.width = `${pct}%`;
    seg.title = `${info.label}: ${formatBytes(size)} (${pct}%)`;
    segmentBar.appendChild(seg);

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-dot ${info.cls}"></div>
      <span>${info.label}</span>
      <span class="legend-value">${formatBytes(size)}</span>
    `;
    segmentLegend.appendChild(item);
  });

  spaceChartSection.classList.remove('hidden');
}

// ── Tech Filter Tags ──────────────────────────────────────────
function buildTechFilterTags(projects) {
  const techs = new Set(['all']);
  projects.forEach(p => techs.add(getTechKey(p.type.toLowerCase())));

  techFiltersEl.innerHTML = '';
  techs.forEach(key => {
    const label = key === 'all' ? 'Todas' : (TECH_COLORS[key]?.label || key);
    const btn = document.createElement('button');
    btn.className = 'tag-filter' + (activeTechFilter === key ? ' active' : '');
    btn.dataset.tech = key;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeTechFilter = key;
      document.querySelectorAll('#techFilters .tag-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRows();
    });
    techFiltersEl.appendChild(btn);
  });
}

// Size filter wiring
document.querySelectorAll('#sizeFilters .tag-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    activeSizeFilter = btn.dataset.size;
    document.querySelectorAll('#sizeFilters .tag-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRows();
  });
});

// ── Tabs Navigation ───────────────────────────────────────────
tabProjects.addEventListener('click', () => {
  if (activeView === 'projects') return;
  activeView = 'projects';
  tabProjects.classList.add('active');
  tabSystem.classList.remove('active');
  tabLargeFiles.classList.remove('active');
  viewProjects.classList.remove('hidden');
  viewSystem.classList.add('hidden');
  viewLargeFiles.classList.add('hidden');
  updateActionBar(); // Hide action bar if no projects selected
});

tabSystem.addEventListener('click', () => {
  if (activeView === 'system') return;
  activeView = 'system';
  tabSystem.classList.add('active');
  tabProjects.classList.remove('active');
  tabLargeFiles.classList.remove('active');
  viewSystem.classList.remove('hidden');
  viewProjects.classList.add('hidden');
  viewLargeFiles.classList.add('hidden');
  updateActionBar(); // Update action bar for system selections
});

tabLargeFiles.addEventListener('click', () => {
  if (activeView === 'largeFiles') return;
  activeView = 'largeFiles';
  tabLargeFiles.classList.add('active');
  tabProjects.classList.remove('active');
  tabSystem.classList.remove('active');
  viewLargeFiles.classList.remove('hidden');
  viewProjects.classList.add('hidden');
  viewSystem.classList.add('hidden');
  updateActionBar();
});

// ── Settings & Whitelist Logic ────────────────────────────────
btnSettings.addEventListener('click', async () => {
  modalSettings.classList.remove('hidden');
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    renderWhitelist(data.config.whitelistedPaths || []);
  } catch(e) {}
});

btnCloseSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));
btnCancelSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));

async function renderWhitelist(paths) {
  whitelistList.innerHTML = '';
  paths.forEach(p => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.innerHTML = `<span>${p}</span><button class="btn-delete-row" title="Eliminar" data-path="${p.replace(/\\/g, '\\\\')}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    li.querySelector('button').addEventListener('click', async () => {
      const newPaths = paths.filter(x => x !== p);
      await fetch('/api/settings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({config: {whitelistedPaths: newPaths}}) });
      renderWhitelist(newPaths);
    });
    whitelistList.appendChild(li);
  });
}

btnAddWhitelist.addEventListener('click', async () => {
  const p = whitelistInput.value.trim();
  if(!p) return;
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const paths = new Set(data.config.whitelistedPaths || []);
    paths.add(p);
    await fetch('/api/settings', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({config: {whitelistedPaths: Array.from(paths)}}) });
    whitelistInput.value = '';
    renderWhitelist(Array.from(paths));
  } catch(e){}
});

btnWhitelistBrowse.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/select-folder');
    const data = await res.json();
    if(data.path) whitelistInput.value = data.path;
  } catch(e) {}
});

// ── System Cleanup Logic ──────────────────────────────────────
btnScanSystem.addEventListener('click', async () => {
  btnScanSystem.disabled = true;
  systemScanLoader.classList.remove('hidden');
  systemResultsPanel.classList.add('hidden');
  systemTableBody.innerHTML = '';
  selectedFolders.clear(); // Reusing this set for system targets
  updateActionBar();

  try {
    const res = await fetch('/api/system/scan');
    const data = await res.json();
    
    if (!data.success) {
      alert('Error: ' + data.error);
      return;
    }

    systemTargets = data.targets;
    renderSystemRows();
    systemResultsPanel.classList.remove('hidden');
  } catch(e) {
    alert('Error de conexión: ' + e.message);
  } finally {
    systemScanLoader.classList.add('hidden');
    btnScanSystem.disabled = false;
  }
});

function renderSystemRows() {
  systemTableBody.innerHTML = '';
  systemTargets.forEach(target => {
    const isSelected = selectedFolders.has(target.id);
    
    const tr = document.createElement('tr');
    if (isSelected) tr.classList.add('selected-row');

    tr.innerHTML = `
      <td><strong>${target.name}</strong></td>
      <td class="text-muted">${target.description}</td>
      <td style="text-align: right; font-weight: 500;">${formatBytes(target.size)}</td>
      <td style="text-align: center;">
        <div class="checkbox-wrapper">
          <input type="checkbox" class="folder-checkbox" data-id="${target.id}" ${isSelected ? 'checked' : ''}>
        </div>
      </td>
    `;

    // Row click toggle
    tr.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      const cb = tr.querySelector('.folder-checkbox');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    // Checkbox logic
    const cb = tr.querySelector('.folder-checkbox');
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selectedFolders.add(target.id);
        tr.classList.add('selected-row');
      } else {
        selectedFolders.delete(target.id);
        tr.classList.remove('selected-row');
      }
      updateActionBar();
    });

    systemTableBody.appendChild(tr);
  });
}

// ── Large Files Logic ─────────────────────────────────────────
let largeFilesData = [];

btnBrowseLarge.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/select-folder');
    const data = await res.json();
    if(data.path) scanLargePathInput.value = data.path;
  } catch(e) {}
});

btnScanLarge.addEventListener('click', async () => {
  const p = scanLargePathInput.value.trim();
  if (!p) return alert('Ingresa una ruta para buscar archivos gigantes.');
  
  btnScanLarge.disabled = true;
  scanLoader.classList.remove('hidden'); // Re-use main loader or add specific one if needed
  selectedFolders.clear();
  updateActionBar();
  
  try {
    const res = await fetch('/api/scan-large-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p })
    });
    const data = await res.json();
    if (data.success) {
      largeFilesData = data.files;
      renderLargeFiles();
    } else {
      alert('Error: ' + data.error);
    }
  } catch(e) {
    alert('Error de conexión.');
  } finally {
    scanLoader.classList.add('hidden');
    btnScanLarge.disabled = false;
  }
});

function renderLargeFiles() {
  largeFilesBody.innerHTML = '';
  if (largeFilesData.length === 0) {
    largeFilesBody.innerHTML = '<tr><td colspan="4" class="empty-state">No se encontraron archivos gigantes (>100MB).</td></tr>';
    return;
  }

  largeFilesData.forEach(file => {
    const isSelected = selectedFolders.has(file.path);
    const tr = document.createElement('tr');
    if (isSelected) tr.classList.add('selected-row');

    tr.innerHTML = `
      <td style="text-align: center;">
        <div class="checkbox-wrapper">
          <input type="checkbox" class="folder-checkbox" data-path="${file.path.replace(/\\/g, '\\\\')}" ${isSelected ? 'checked' : ''}>
        </div>
      </td>
      <td><strong>${file.name}</strong></td>
      <td class="text-muted" style="word-break: break-all;">${file.path}</td>
      <td style="text-align: right; font-weight: 500;">${formatBytes(file.size)}</td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      const cb = tr.querySelector('.folder-checkbox');
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    const cb = tr.querySelector('.folder-checkbox');
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selectedFolders.add(file.path);
        tr.classList.add('selected-row');
      } else {
        selectedFolders.delete(file.path);
        tr.classList.remove('selected-row');
      }
      updateActionBar();
      checkAllLargeFiles.checked = (selectedFolders.size === largeFilesData.length && largeFilesData.length > 0);
    });

    largeFilesBody.appendChild(tr);
  });
  
  checkAllLargeFiles.checked = (selectedFolders.size === largeFilesData.length && largeFilesData.length > 0);
}

checkAllLargeFiles.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  largeFilesData.forEach(file => {
    if (isChecked) selectedFolders.add(file.path);
    else selectedFolders.delete(file.path);
  });
  renderLargeFiles();
  updateActionBar();
});

// ── Render Table Rows (with filters) ─────────────────────────
function renderRows() {
  projectAccordionList.innerHTML = '';
  
  // Apply filters
  const filtered = scannedProjects.filter(p => {
    if (activeTechFilter !== 'all' && getTechKey(p.type.toLowerCase()) !== activeTechFilter) return false;
    if (activeSizeFilter !== 'all') {
      const minSize = parseInt(activeSizeFilter, 10) * 1024 * 1024;
      if (p.totalRecoverable < minSize) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    projectAccordionList.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay proyectos que coincidan con los filtros.</div>';
    return;
  }

  filtered.forEach(project => {
    const isOld = isInactive(project.lastModified);
    const techKey = getTechKey(project.type.toLowerCase());
    
    // Project summary sizes
    let projectSize = 0;
    let allSelected = true;
    let someSelected = false;
    project.folders.forEach(f => {
      projectSize += f.size;
      if (selectedFolders.has(f.path)) someSelected = true;
      else allSelected = false;
    });

    const card = document.createElement('div');
    card.className = 'accordion-card';
    
    const header = document.createElement('div');
    header.className = 'accordion-header';
    header.innerHTML = `
      <div class="accordion-header-left">
        <div class="project-name-cell" style="margin:0;">
          <span class="project-name">${project.name}</span>
          <span class="tech-badge ${getBadgeClass(techKey)}">${TECH_COLORS[techKey]?.label || project.type}</span>
          ${isOld ? '<span class="inactive-badge" title="Sin modificar por más de 30 días">Inactivo +30d</span>' : ''}
        </div>
        <div class="project-path" style="margin-top: 4px;">${project.path}</div>
      </div>
      <div class="accordion-header-right">
        <span style="font-weight: 600; color: var(--text-color);">${formatBytes(projectSize)}</span>
        <div class="checkbox-wrapper">
          <input type="checkbox" class="project-master-checkbox" ${allSelected ? 'checked' : ''} ${!allSelected && someSelected ? 'indeterminate' : ''}>
        </div>
        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'accordion-body';

    // Toggle accordion
    header.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return; // let checkbox do its thing
      body.classList.toggle('open');
      header.querySelector('.chevron').classList.toggle('open');
    });

    // Master checkbox logic
    const masterCb = header.querySelector('.project-master-checkbox');
    if (!allSelected && someSelected) masterCb.indeterminate = true;
    
    masterCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      project.folders.forEach(f => {
        if (isChecked) selectedFolders.add(f.path);
        else selectedFolders.delete(f.path);
      });
      // Re-render to update child checkboxes
      renderRows();
      updateActionBar();
    });

    project.folders.forEach(folder => {
      const isSelected = selectedFolders.has(folder.path);
      const folderRow = document.createElement('div');
      folderRow.className = 'folder-row';
      folderRow.innerHTML = `
        <div class="folder-row-left">
          <span class="text-muted" style="width: 150px;">${folder.name}</span>
          ${folder.hasExecutables ? '<span class="tech-badge" style="background:#451a1a; color:#f87171; font-size:0.7rem; margin-right:8px;" title="Contiene archivos compilados (.exe, etc)">⚠️ Ejecutables</span>' : ''}
          <code class="cmd-snippet" title="Copiar al portapapeles" onclick="navigator.clipboard.writeText('${folder.regen}')">${folder.regen}</code>
        </div>
        <div class="folder-row-right">
          <span style="font-weight: 500; font-size: 0.9rem;">${formatBytes(folder.size)}</span>
          <div class="checkbox-wrapper">
            <input type="checkbox" class="folder-checkbox" data-path="${folder.path.replace(/\\/g, '\\\\')}" ${isSelected ? 'checked' : ''}>
          </div>
          <button class="btn-delete-row" title="Limpiar solo este" data-path="${folder.path.replace(/\\/g, '\\\\')}" data-size="${folder.size}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;

      // Folder checkbox logic
      const cb = folderRow.querySelector('.folder-checkbox');
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedFolders.add(folder.path);
        } else {
          selectedFolders.delete(folder.path);
        }
        renderRows(); // re-evaluate master checkbox
        updateActionBar();
      });

      // Single delete logic
      const btnDel = folderRow.querySelector('.btn-delete-row');
      btnDel.addEventListener('click', () => {
        pendingDeletePath = folder.path;
        pendingDeleteSize = folder.size;
        confirmList.innerHTML = `<li>${folder.path}</li>`;
        
        if (folder.hasExecutables) {
          executablesWarning.classList.remove('hidden');
        } else {
          executablesWarning.classList.add('hidden');
        }
        
        modalConfirm.classList.remove('hidden');
      });

      body.appendChild(folderRow);
    });

    card.appendChild(header);
    card.appendChild(body);
    projectAccordionList.appendChild(card);
  });
}

function updateActionBar() {
  if (activeView === 'system') {
    if (selectedFolders.size > 0) {
      let total = 0;
      systemTargets.forEach(t => { if (selectedFolders.has(t.id)) total += t.size; });
      selectionCountText.textContent = `${selectedFolders.size} objetivos del sistema seleccionados`;
      selectionSizeText.textContent = formatBytes(total);
      actionBar.classList.remove('hidden');
    } else {
      actionBar.classList.add('hidden');
    }
  } else {
    if (selectedFolders.size > 0) {
      let total = 0;
      selectedFolders.forEach(path => total += getFolderSizeByPath(path));
      selectionCountText.textContent = `${selectedFolders.size} elementos seleccionados`;
      selectionSizeText.textContent = formatBytes(total);
      actionBar.classList.remove('hidden');
    } else {
      actionBar.classList.add('hidden');
    }
  }
}

// ── Scanning ──────────────────────────────────────────────────
btnScan.addEventListener('click', async () => {
  const p = scanPathInput.value.trim();
  if (!p) return alert('Por favor, ingresa una ruta válida.');
  
  btnScan.disabled = true;
  scanLoader.classList.remove('hidden');
  emptyState.classList.add('hidden');
  resultsPanel.classList.add('hidden');
  spaceChartSection.classList.add('hidden');
  selectedFolders.clear();
  updateActionBar();
  
  let animationInterval = setInterval(() => {
    scanningCurrentPath.textContent = 'Analizando subcarpetas... ' + Math.floor(Math.random() * 100) + '%';
  }, 300);

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p })
    });
    const data = await res.json();
    
    clearInterval(animationInterval);
    
    if (data.success) {
      scannedProjects = data.projects;
      
      // Update stats
      let recov = 0;
      scannedProjects.forEach(p => {
        p.totalRecoverable = p.folders.reduce((acc, f) => acc + f.size, 0);
        recov += p.totalRecoverable;
      });
      statRecoverable.textContent = formatBytes(recov);
      statProjects.textContent = scannedProjects.length;
      
      buildTechFilterTags(scannedProjects);
      renderSpaceChart(scannedProjects);
      renderRows();
      
      resultsPanel.classList.remove('hidden');
    } else {
      emptyState.classList.remove('hidden');
      alert('Error al escanear: ' + data.error);
    }
  } catch(e) {
    clearInterval(animationInterval);
    emptyState.classList.remove('hidden');
    alert('Error de red al escanear.');
  } finally {
    scanLoader.classList.add('hidden');
    btnScan.disabled = false;
  }
});

// ── Global Actions ────────────────────────────────────────────
btnSelectAllGlobal.addEventListener('click', () => {
  if (activeView === 'system') {
    systemTargets.forEach(t => selectedFolders.add(t.id));
    renderSystemRows();
  } else if (activeView === 'largeFiles') {
    largeFilesData.forEach(f => selectedFolders.add(f.path));
    renderLargeFiles();
  } else {
    scannedProjects.forEach(p => p.folders.forEach(f => selectedFolders.add(f.path)));
    renderRows();
  }
  updateActionBar();
});

btnDeselectAllGlobal.addEventListener('click', () => {
  selectedFolders.clear();
  if (activeView === 'system') renderSystemRows();
  else if (activeView === 'largeFiles') renderLargeFiles();
  else renderRows();
  updateActionBar();
});

// ── Modal Handlers ────────────────────────────────────────────
btnCleanSelected.addEventListener('click', () => {
  pendingDeletePath = null; // means bulk mode
  confirmList.innerHTML = '';
  executablesWarning.classList.add('hidden');
  
  if (activeView === 'system') {
    systemTargets.forEach(t => {
      if (selectedFolders.has(t.id)) {
        const li = document.createElement('li');
        li.textContent = t.name;
        confirmList.appendChild(li);
      }
    });
  } else if (activeView === 'largeFiles') {
    largeFilesData.forEach(f => {
      if (selectedFolders.has(f.path)) {
        const li = document.createElement('li');
        li.textContent = f.name;
        confirmList.appendChild(li);
      }
    });
  } else {
    let hasExec = false;
    scannedProjects.forEach(p => {
      p.folders.forEach(f => {
        if (selectedFolders.has(f.path)) {
          const li = document.createElement('li');
          li.textContent = f.path;
          confirmList.appendChild(li);
          if (f.hasExecutables) hasExec = true;
        }
      });
    });
    if (hasExec) executablesWarning.classList.remove('hidden');
  }
  modalConfirm.classList.remove('hidden');
});

btnCloseConfirm.addEventListener('click', () => modalConfirm.classList.add('hidden'));
btnCancelConfirm.addEventListener('click', () => modalConfirm.classList.add('hidden'));

// btnExecuteConfirm logic (already bound previously? No, let's redefine it here and overwrite any original)
// In JS, adding multiple listeners will fire all of them. But we wiped the old listener because it was in the deleted code.
// The new one we added earlier was empty. We can just replace the whole thing.
btnExecuteConfirm.addEventListener('click', async () => {
  modalConfirm.classList.add('hidden');
  modalProgress.classList.remove('hidden');
  progressActionRow.classList.add('hidden');
  progressBarFill.style.width = '0%';
  deletionLog.innerHTML = '';
  
  progressTitle.textContent = 'Limpiando...';
  progressSubtitle.textContent = 'Por favor espera';
  
  let targetPaths = [];
  if (activeView === 'system') {
    targetPaths = Array.from(selectedFolders);
  } else if (activeView === 'largeFiles') {
    targetPaths = Array.from(selectedFolders);
  } else {
    if (pendingDeletePath) targetPaths = [pendingDeletePath];
    else targetPaths = Array.from(selectedFolders);
  }

  progressBarFill.style.width = '50%';
  
  let endpoint = '/api/delete';
  let payload = { paths: targetPaths };
  
  if (activeView === 'system') {
    endpoint = '/api/system/delete';
    payload = { targets: targetPaths };
  } else if (activeView === 'largeFiles') {
    endpoint = '/api/delete-large-files';
    payload = { files: targetPaths };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    progressBarFill.style.width = '100%';
    
    if (data.success) {
      progressTitle.textContent = '¡Limpieza Completada!';
      const freedStr = formatBytes(data.totalFreed);
      progressSubtitle.textContent = `Se liberaron ${freedStr} en total.`;
      
      data.results.forEach(r => {
        const p = document.createElement('p');
        p.className = r.success ? 'log-success' : 'log-error';
        const name = r.id || r.path;
        p.textContent = r.success ? `✓ Eliminado: ${name}` : `✗ Error en ${name}: ${r.error || r.msg}`;
        deletionLog.appendChild(p);
      });
      
      totalFreedToday += data.totalFreed;
      statFreed.textContent = formatBytes(totalFreedToday);
      saveHistoricalFreed(data.totalFreed);
      
      if (activeView === 'system') {
        targetPaths.forEach(id => selectedFolders.delete(id));
        btnScanSystem.click();
      } else if (activeView === 'largeFiles') {
        targetPaths.forEach(path => selectedFolders.delete(path));
        btnScanLarge.click();
      } else {
        targetPaths.forEach(path => selectedFolders.delete(path));
        btnScan.click(); // re-scan projects
      }
    } else {
      progressTitle.textContent = 'Error en Limpieza';
      progressSubtitle.textContent = data.error;
    }
  } catch(e) {
    progressTitle.textContent = 'Error';
    progressSubtitle.textContent = 'Falló la conexión.';
  } finally {
    progressActionRow.classList.remove('hidden');
    updateActionBar();
  }
});

btnFinishProgress.addEventListener('click', () => {
  modalProgress.classList.add('hidden');
});

// ── File Browser Modal ────────────────────────────────────────
btnBrowse.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/select-folder');
    const data = await res.json();
    if (data.path) {
      scanPathInput.value = data.path;
      btnScan.click();
    } else if (data.error === 'Not in electron mode') {
      // Fallback a modal personalizado
      modalBrowse.classList.remove('hidden');
      await loadBrowserPath('');
    }
  } catch(e) {
    console.error(e);
    modalBrowse.classList.remove('hidden');
    loadBrowserPath('');
  }
});
btnCloseBrowse.addEventListener('click', () => modalBrowse.classList.add('hidden'));
btnCancelBrowse.addEventListener('click', () => modalBrowse.classList.add('hidden'));

btnSelectActiveFolder.addEventListener('click', () => {
  if (activeFolderInBrowser) {
    scanPathInput.value = activeFolderInBrowser;
    modalBrowse.classList.add('hidden');
    btnScan.click();
  }
});

btnBrowseUp.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/browseUp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPath: browserCurrentPath })
    });
    const data = await res.json();
    if (data.success) renderBrowser(data);
  } catch(e) { console.error(e); }
});

async function loadBrowserPath(p) {
  try {
    const res = await fetch('/api/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p })
    });
    const data = await res.json();
    if (data.success) renderBrowser(data);
  } catch(e) { console.error(e); }
}

function renderBrowser(data) {
  browserCurrentPath = data.currentPath;
  activeFolderInBrowser = data.currentPath;
  browserCurrentPathText.textContent = data.currentPath;
  
  browserList.innerHTML = '';
  data.directories.forEach(dir => {
    const li = document.createElement('li');
    li.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      <span>${dir.name}</span>
    `;
    li.addEventListener('click', () => loadBrowserPath(dir.path));
    browserList.appendChild(li);
  });
}

// ── Quick Paths ───────────────────────────────────────────────
quickHome.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/browse');
    const data = await res.json();
    if(data.success) { scanPathInput.value = data.currentPath; btnScan.click(); }
  } catch(e){}
});
quickDownloads.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/browse');
    const data = await res.json();
    if(data.success) { scanPathInput.value = data.currentPath + '\\\\Downloads'; btnScan.click(); }
  } catch(e){}
});
quickDocuments.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/browse');
    const data = await res.json();
    if(data.success) { scanPathInput.value = data.currentPath + '\\\\Documents'; btnScan.click(); }
  } catch(e){}
});

// Boot
initDefaults();
