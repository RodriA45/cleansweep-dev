const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Config Management (Lista Blanca) ---
const getConfigPath = () => {
  const base = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Preferences') : path.join(process.env.HOME, '.local', 'share'));
  const appDir = path.join(base, 'CleanSweep Dev v2');
  if (!fsSync.existsSync(appDir)) {
    fsSync.mkdirSync(appDir, { recursive: true });
  }
  return path.join(appDir, 'config.json');
};

const getConfig = () => {
  const p = getConfigPath();
  if (fsSync.existsSync(p)) {
    try { return JSON.parse(fsSync.readFileSync(p, 'utf8')); } catch(e){}
  }
  return { whitelistedPaths: [] };
};

const saveConfig = (cfg) => {
  fsSync.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
};

// Safe folders we can clean (regenerable dependencies/cache/compiles)
const CLEANABLE_NAMES = [
  'node_modules',
  'venv',
  '.venv',
  'env',
  'target',
  'bin',
  'obj',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.parcel-cache',
  '.pytest_cache',
  '__pycache__',
  '.gradle',
  '.m2'
];

// Folders where we preserve build artifacts like .exe, .zip, etc.
const PRESERVE_IN_FOLDERS = ['dist', 'build', 'out', 'target', 'bin'];

// File extensions to preserve in the above folders
const PRESERVE_EXTS = [
  '.exe', '.msi', '.zip', '.tar.gz', '.tgz', '.dmg', '.pkg', 
  '.appimage', '.deb', '.rpm', '.apk', '.msix', '.appx'
];

// Folders we should NEVER descend into during directory walk
const EXCLUDE_WALK = [
  '.git',
  'node_modules',
  'venv',
  '.venv',
  'env',
  'target',
  'bin',
  'obj',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.parcel-cache',
  '.gradle',
  'AppData',
  'Local Settings',
  'Program Files',
  'Program Files (x86)',
  'Windows',
  'System Volume Information'
];

// Metadata for folders (user friendly descriptions)
const FOLDER_META = {
  'node_modules': { label: 'Dependencias de Node.js', regen: 'npm install' },
  'venv': { label: 'Entorno Virtual Python', regen: 'pip install -r requirements.txt' },
  '.venv': { label: 'Entorno Virtual Python', regen: 'pip install -r requirements.txt' },
  'env': { label: 'Entorno Virtual Python', regen: 'pip install -r requirements.txt' },
  'target': { label: 'Compilados de Rust', regen: 'cargo build' },
  'bin': { label: 'Compilados C# (bin)', regen: 'dotnet build' },
  'obj': { label: 'Compilados C# (obj)', regen: 'dotnet build' },
  'dist': { label: 'Distribución / Build', regen: 'npm run build' },
  'build': { label: 'Compilados / Build', regen: 'npm run build' },
  '.next': { label: 'Caché de Next.js', regen: 'npm run build' },
  '.nuxt': { label: 'Caché de Nuxt.js', regen: 'npm run build' },
  '.cache': { label: 'Caché de compilación', regen: 'Automático' },
  '.parcel-cache': { label: 'Caché de Parcel', regen: 'Automático' },
  '.pytest_cache': { label: 'Caché de Pytest', regen: 'pytest' },
  '__pycache__': { label: 'Caché de Python', regen: 'Automático' },
  '.gradle': { label: 'Caché de Gradle', regen: 'gradlew build' },
  '.m2': { label: 'Caché Maven (Java)', regen: 'mvn install' }
};

// Files that identify project types
const SIGNATURES = {
  'package.json': 'Node.js',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'Pipfile': 'Python',
  'Cargo.toml': 'Rust',
  '.csproj': 'C# / .NET',
  '.sln': 'C# / .NET',
  'build.gradle': 'Java/Gradle',
  'pom.xml': 'Java/Maven',
  '.git': 'Git Repo'
};

// Helper: Calculate folder size with concurrency limit to avoid EMFILE
// Now returns { size, hasExecutables }
async function getFolderSizeAndInfo(dirPath) {
  let size = 0;
  let hasExecutables = false;
  const queue = [dirPath];
  const maxConcurrency = 40;
  let activePromises = 0;

  const EXEC_EXTS = ['.exe', '.msi', '.apk', '.dmg', '.pkg', '.appimage', '.deb'];

  return new Promise((resolve) => {
    async function processQueue() {
      if (queue.length === 0 && activePromises === 0) {
        return resolve({ size, hasExecutables });
      }

      while (queue.length > 0 && activePromises < maxConcurrency) {
        const currentPath = queue.shift();
        activePromises++;

        fs.readdir(currentPath, { withFileTypes: true })
          .then(async (entries) => {
            const subdirs = [];
            const files = [];

            for (const entry of entries) {
              const fullPath = path.join(currentPath, entry.name);
              if (entry.isDirectory()) {
                subdirs.push(fullPath);
              } else if (entry.isFile()) {
                files.push(fullPath);
              }
            }

            queue.push(...subdirs);

            // Fetch file sizes and check for executables
            await Promise.all(
              files.map(async (f) => {
                const ext = path.extname(f).toLowerCase();
                if (EXEC_EXTS.includes(ext)) {
                  hasExecutables = true;
                }
                try {
                  const stat = await fs.stat(f);
                  size += stat.size;
                } catch (err) {
                  // Ignore stats error for individual locked files
                }
              })
            );
          })
          .catch(() => {
            // Ignore readdir errors (permissions)
          })
          .finally(() => {
            activePromises--;
            processQueue();
          });
      }
    }

    processQueue();
  });
}

// Settings API
app.get('/api/settings', (req, res) => {
  res.json({ success: true, config: getConfig() });
});

app.post('/api/settings', (req, res) => {
  const { config } = req.body;
  if (config) {
    saveConfig(config);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Configuración inválida' });
  }
});

// Helper: Scan directory for programming projects
async function scanPath(scanRoot, maxDepth = 5) {
  const config = getConfig();
  const whitelistedPaths = config.whitelistedPaths || [];
  const projects = [];

  async function walk(currentPath, depth) {
    if (depth > maxDepth) return;
    
    // Si la ruta actual está en la lista blanca, abortar
    if (whitelistedPaths.some(wp => currentPath.startsWith(wp))) {
      return;
    }

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      let projectType = null;
      let isProjectRoot = false;
      const cleanableFound = [];
      const subdirsToWalk = [];

      for (const entry of entries) {
        const name = entry.name;
        const fullPath = path.join(currentPath, name);

        if (entry.isFile()) {
          // Check extensions & filenames
          if (SIGNATURES[name]) {
            projectType = SIGNATURES[name];
            isProjectRoot = true;
          } else {
            const ext = path.extname(name);
            if (SIGNATURES[ext]) {
              projectType = SIGNATURES[ext];
              isProjectRoot = true;
            }
          }
        } else if (entry.isDirectory()) {
          if (name === '.git') {
            projectType = projectType || 'Git Repo';
            isProjectRoot = true;
          }

          if (CLEANABLE_NAMES.includes(name)) {
            cleanableFound.push({ name, path: fullPath });
          } else if (!EXCLUDE_WALK.includes(name)) {
            subdirsToWalk.push(fullPath);
          }
        }
      }

      // If project root OR has loose cleanable folders
      if (isProjectRoot || cleanableFound.length > 0) {
        const projectFolders = [];
        
        for (const item of cleanableFound) {
          const info = await getFolderSizeAndInfo(item.path);
          // Always show key folders, or others if they have size > 0
          if (info.size > 0 || ['node_modules', '.venv', 'venv'].includes(item.name)) {
            const meta = FOLDER_META[item.name] || { label: 'Temporal', regen: 'Automático' };
            projectFolders.push({
              name: item.name,
              path: item.path,
              size: info.size,
              hasExecutables: info.hasExecutables,
              label: meta.label,
              regen: meta.regen
            });
          }
        }

        if (projectFolders.length > 0) {
          let lastModified = new Date();
          try {
            const stat = await fs.stat(currentPath);
            lastModified = stat.mtime;
          } catch(e) {}

          projects.push({
            name: path.basename(currentPath) || currentPath,
            path: currentPath,
            type: projectType || 'Proyecto de Código',
            folders: projectFolders,
            lastModified
          });
        }
      }

      // Descend to subfolders (in parallel)
      const walkPromises = subdirsToWalk.map(subdir => walk(subdir, depth + 1));
      await Promise.all(walkPromises);

    } catch (e) {
      // Ignore read errors
    }
  }

  await walk(scanRoot, 0);
  return projects;
}

// --- ENDPOINTS ---

// 0. Native Folder Picker (Windows only)
app.get('/api/pick-folder', async (req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ success: false, error: 'La selección nativa solo está soportada en Windows.' });
  }

  const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.ValidateNames = $false; $d.CheckFileExists = $false; $d.CheckPathExists = $true; $d.FileName = 'Seleccionar carpeta'; $d.Title = 'Entra en la carpeta a escanear y haz clic en Abrir'; $d.Filter = 'Carpetas|*.'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Split-Path -Path $d.FileName }"`;

  exec(psCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('Error al ejecutar el selector nativo:', error);
      return res.json({ success: false, error: error.message });
    }

    const selectedPath = stdout.trim();
    res.json({ success: true, path: selectedPath || null });
  });
});

// 1. File Explorer
app.get('/api/browse', async (req, res) => {
  let targetPath = req.query.path || '';
  
  if (!targetPath) {
    targetPath = os.homedir();
  }

  try {
    const absolutePath = path.resolve(targetPath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    
    const folders = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;
        // Exclude system files and common scan exclusion directories
        if (name.startsWith('.') && name !== '.git') continue;
        if (EXCLUDE_WALK.includes(name) && name !== '.git') continue;

        folders.push({
          name,
          path: path.join(absolutePath, name)
        });
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(absolutePath);

    res.json({
      success: true,
      currentPath: absolutePath,
      parentPath: parentPath !== absolutePath ? parentPath : null,
      folders
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Error al leer la carpeta: ${err.message}`,
      currentPath: targetPath,
      parentPath: null,
      folders: []
    });
  }
});

// 2. Scan Directory
app.post('/api/scan', async (req, res) => {
  const { path: scanPathInput } = req.body;
  if (!scanPathInput) {
    return res.status(400).json({ success: false, error: 'Se requiere una ruta válida.' });
  }

  try {
    const targetPath = path.resolve(scanPathInput);
    const stats = await fs.stat(targetPath);
    
    if (!stats.isDirectory()) {
      return res.status(400).json({ success: false, error: 'La ruta no corresponde a un directorio.' });
    }

    const projects = await scanPath(targetPath, 5);
    res.json({
      success: true,
      path: targetPath,
      projects
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Error al escanear: ${err.message}`
    });
  }
});


// 3. Delete Selected Folders
app.post('/api/delete', async (req, res) => {
  const { paths } = req.body;
  if (!paths || !Array.isArray(paths)) {
    return res.status(400).json({ success: false, error: 'Lista de rutas inválida.' });
  }

  const results = [];
  let totalFreed = 0;

  for (const dirPath of paths) {
    try {
      const absolutePath = path.resolve(dirPath);
      const folderName = path.basename(absolutePath);

      // SECURITY AUDIT 1: Only delete allowed directories
      if (!CLEANABLE_NAMES.includes(folderName)) {
        throw new Error('Operación no permitida: esta carpeta no es catalogada como segura.');
      }

      // SECURITY AUDIT 2: Prevent deleting directly at disk root level (e.g. C:\node_modules)
      const parentDir = path.dirname(absolutePath);
      if (parentDir === absolutePath || parentDir === path.parse(absolutePath).root) {
        throw new Error('Operación bloqueada por seguridad: no se permite eliminar carpetas en la raíz del disco.');
      }

      // Check existence
      try {
        await fs.access(absolutePath);
      } catch (e) {
        results.push({ path: absolutePath, success: true, freed: 0, msg: 'Ya no existe' });
        continue;
      }

      const info = await getFolderSizeAndInfo(absolutePath);
      
      // We always delete the entire folder to ensure clean state and avoid corrupting apps.
      // If the user wants to keep a dist folder, they can uncheck it in the UI.
      await fs.rm(absolutePath, { recursive: true, force: true });
      
      totalFreed += info.size;
      results.push({ path: absolutePath, success: true, freed: info.size });
    } catch (err) {
      results.push({ path: dirPath, success: false, error: err.message });
    }
  }

  res.json({
    success: true,
    results,
    totalFreed
  });
});

// 4. System Cleanup Scan
app.get('/api/system/scan', async (req, res) => {
  try {
    const targets = [];
    const getDirSize = async (dir) => { try { const info = await getFolderSizeAndInfo(dir); return info.size; } catch(e) { return 0; } };

    // User Temp
    const tempDir = os.tmpdir();
    targets.push({ id: 'temp', name: 'Archivos Temporales', description: 'Basura temporal de aplicaciones del usuario', size: await getDirSize(tempDir) });

    // Recycle Bin
    let recycleSize = 0;
    if (process.platform === 'win32') {
      try {
        const psCommand = `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(10).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum"`;
        const stdout = await new Promise((resolve) => exec(psCommand, (err, out) => resolve(out)));
        const match = stdout.match(/\d+/);
        if (match) recycleSize = parseInt(match[0], 10);
      } catch(e) {}
    }
    targets.push({ id: 'recycle', name: 'Papelera de Reciclaje', description: 'Archivos eliminados', size: recycleSize });

    // NPM Cache
    let npmSize = 0;
    try {
      const stdout = await new Promise((resolve) => exec('npm config get cache', (err, out) => resolve(out)));
      const npmCacheDir = stdout.trim();
      if (npmCacheDir) npmSize = await getDirSize(npmCacheDir);
    } catch(e) {}
    targets.push({ id: 'npm', name: 'Caché de NPM', description: 'Paquetes globales cacheados por Node.js', size: npmSize });

    // Browser Caches (Windows)
    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        const chromeCache = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data');
        const edgeCache = path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data');
        const firefoxProfiles = path.join(localAppData, 'Mozilla', 'Firefox', 'Profiles');
        
        targets.push({ id: 'chrome', name: 'Caché de Chrome', description: 'Archivos temporales del navegador web', size: await getDirSize(chromeCache) });
        targets.push({ id: 'edge', name: 'Caché de Edge', description: 'Archivos temporales del navegador web', size: await getDirSize(edgeCache) });
        targets.push({ id: 'firefox', name: 'Caché de Firefox', description: 'Archivos temporales del navegador web', size: await getDirSize(firefoxProfiles) });
      }
      
      const winUpdate = 'C:\\Windows\\SoftwareDistribution\\Download';
      targets.push({ id: 'winupdate', name: 'Caché Windows Update', description: 'Instaladores residuales de Windows', size: await getDirSize(winUpdate) });
    }

    // Maven Cache
    const mavenCache = path.join(os.homedir(), '.m2', 'repository');
    targets.push({ id: 'maven', name: 'Caché Maven (.m2)', description: 'Dependencias globales de Java', size: await getDirSize(mavenCache) });

    // Docker (Prune check)
    try {
      await new Promise((resolve, reject) => exec('docker --version', (err) => err ? reject(err) : resolve()));
      // If docker exists, add target with an estimated 0 size (or hard to parse), UI will show "Desconocido"
      targets.push({ id: 'docker', name: 'Limpieza de Docker', description: 'Eliminar contenedores, redes e imágenes huérfanas', size: 0 });
    } catch(e) {
      // Docker not installed, don't show
    }

    res.json({ success: true, targets });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. System Cleanup Delete
app.post('/api/system/delete', async (req, res) => {
  const { targets } = req.body;
  if (!targets || !Array.isArray(targets)) {
    return res.status(400).json({ success: false, error: 'Lista de objetivos inválida.' });
  }

  const results = [];
  let totalFreed = 0;
  const getDirSize = async (dir) => { try { const info = await getFolderSizeAndInfo(dir); return info.size; } catch(e) { return 0; } };

  for (const targetId of targets) {
    try {
      if (targetId === 'temp') {
        const tempDir = os.tmpdir();
        const size = await getDirSize(tempDir);
        await fs.rm(tempDir, { recursive: true, force: true }).catch(()=>{});
        totalFreed += size;
        results.push({ id: targetId, success: true, freed: size });
      } 
      else if (targetId === 'recycle' && process.platform === 'win32') {
        const psCommand = `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(10).Items() | Measure-Object -Property Size -Sum | Select-Object -ExpandProperty Sum"`;
        const stdout = await new Promise((resolve) => exec(psCommand, (err, out) => resolve(out)));
        const match = stdout.match(/\d+/);
        const size = match ? parseInt(match[0], 10) : 0;
        
        await new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        totalFreed += size;
        results.push({ id: targetId, success: true, freed: size });
      }
      else if (targetId === 'npm') {
        const stdout = await new Promise((resolve) => exec('npm config get cache', (err, out) => resolve(out)));
        const npmCacheDir = stdout.trim();
        let size = 0;
        if (npmCacheDir) {
          size = await getDirSize(npmCacheDir);
          await new Promise((resolve, reject) => {
            exec('npm cache clean --force', (err) => {
              if (err) reject(err); else resolve();
            });
          });
        }
        totalFreed += size;
        results.push({ id: targetId, success: true, freed: size });
      }
      else if (['chrome', 'edge', 'firefox', 'winupdate', 'maven'].includes(targetId)) {
        let dirPath = null;
        if (targetId === 'chrome') dirPath = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data');
        if (targetId === 'edge') dirPath = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data');
        if (targetId === 'firefox') dirPath = path.join(process.env.LOCALAPPDATA, 'Mozilla', 'Firefox', 'Profiles');
        if (targetId === 'winupdate') dirPath = 'C:\\Windows\\SoftwareDistribution\\Download';
        if (targetId === 'maven') dirPath = path.join(os.homedir(), '.m2', 'repository');
        
        const size = await getDirSize(dirPath);
        await fs.rm(dirPath, { recursive: true, force: true }).catch(()=>{});
        totalFreed += size;
        results.push({ id: targetId, success: true, freed: size });
      }
      else if (targetId === 'docker') {
        await new Promise((resolve, reject) => {
          exec('docker system prune -f', (err) => {
            if (err) reject(err); else resolve();
          });
        });
        results.push({ id: targetId, success: true, freed: 0 }); // Hard to calculate accurate freed size
      }
    } catch(err) {
      results.push({ id: targetId, success: false, error: err.message });
    }
  }

  res.json({ success: true, results, totalFreed });
});

// Endpoint for native Windows folder picker via Electron
app.get('/api/select-folder', async (req, res) => {
  if (process.env.ELECTRON_MODE === '1') {
    try {
      const { dialog, BrowserWindow } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
      });
      if (!result.canceled && result.filePaths.length > 0) {
        res.json({ path: result.filePaths[0] });
      } else {
        res.json({ path: null });
      }
    } catch (err) {
      res.json({ path: null, error: err.message });
    }
  } else {
    // Fallback if not in Electron
    res.json({ path: null, error: 'Not in electron mode' });
  }
});

// Large Files Finder Endpoint
app.post('/api/scan-large-files', async (req, res) => {
  const { path: scanPathInput, minSizeMB = 100 } = req.body;
  if (!scanPathInput) return res.status(400).json({ success: false, error: 'Se requiere ruta.' });

  const config = getConfig();
  const whitelistedPaths = config.whitelistedPaths || [];
  const minSizeBytes = minSizeMB * 1024 * 1024;
  const largeFiles = [];

  const walk = async (currentPath, depth) => {
    if (depth > 10) return; // Prevent too deep recursion
    if (whitelistedPaths.some(wp => currentPath.startsWith(wp))) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size >= minSizeBytes) {
              largeFiles.push({ path: fullPath, size: stat.size, name: entry.name, ext: path.extname(entry.name) });
            }
          } catch(e) {}
        } else if (entry.isDirectory() && !EXCLUDE_WALK.includes(entry.name)) {
          await walk(fullPath, depth + 1);
        }
      }
    } catch(e) {}
  };

  try {
    await walk(path.resolve(scanPathInput), 0);
    // Sort by size descending and take top 50
    largeFiles.sort((a, b) => b.size - a.size);
    res.json({ success: true, files: largeFiles.slice(0, 50) });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete Large Files Endpoint
app.post('/api/delete-large-files', async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files)) return res.status(400).json({ success: false, error: 'Lista inválida.' });

  let totalFreed = 0;
  const results = [];

  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      await fs.unlink(file);
      totalFreed += stat.size;
      results.push({ path: file, success: true, freed: stat.size });
    } catch(e) {
      results.push({ path: file, success: false, error: e.message });
    }
  }
  res.json({ success: true, results, totalFreed });
});

// Start server only if not running inside Electron
if (process.env.ELECTRON_MODE !== '1') {
  app.listen(PORT, () => {
    console.log(`CleanSweep Dev escuchando en http://localhost:${PORT}`);

    const url = `http://localhost:${PORT}`;
    let command;
    if (process.platform === 'win32') {
      command = `start ${url}`;
    } else if (process.platform === 'darwin') {
      command = `open ${url}`;
    } else {
      command = `xdg-open ${url}`;
    }

    exec(command, (err) => {
      if (err) {
        console.log(`No se pudo abrir automáticamente el navegador: ${err.message}`);
      }
    });
  });
}

// Export for Electron usage
module.exports = app;
