# 🧹 CleanSweep Dev v2

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/electron-31.x-47848F.svg)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)]()
[![License](https://img.shields.io/badge/license-ISC-lightgrey.svg)](https://opensource.org/licenses/ISC)

**CleanSweep Dev v2** es la versión premium del limpiador selectivo de espacio en disco para desarrolladores. Con interfaz dark mode de estética SaaS, escaneo inteligente por tecnología, filtros avanzados, historial de ahorro persistente y empaquetado como aplicación de escritorio nativa.

<div align="center">
  <img src="https://via.placeholder.com/800x450/0b0f17/94a3b8?text=Arrastra+y+suelta+aqui+un+GIF+o+Captura+de+Pantalla+en+GitHub" alt="CleanSweep Dev Interface Demo" width="800" style="border-radius: 8px; margin: 20px 0;">
</div>

---

## ✨ Funcionalidades

### 🆕 Exclusivo de v2

| Funcionalidad | Descripción |
| :--- | :--- |
| 📊 **Gráfico de distribución** | Barra segmentada por tecnología (Node.js, Python, Rust, etc.) |
| 💾 **Ahorro histórico total** | Persiste en `localStorage` el total liberado en todas las sesiones |
| 💤 **Badge de inactividad** | Marca proyectos sin modificar en más de 30 días con **"Inactivo +30d"** |
| 🔍 **Filtros de tabla** | Por tecnología (dinámico) y por tamaño mínimo (50 MB / 500 MB) |
| 🗑️ **Papelera por fila** | Elimina una carpeta individual sin necesidad de tildarla |
| 🛡️ **Panel de Configuración** | Gestiona una Lista Blanca de carpetas que jamás serán escaneadas |
| 🐳 **Docker Prune** | Limpia imágenes y contenedores en desuso desde la UI |
| 🌐 **Cachés de Sistema** | Elimina caché de navegadores (Chrome, Edge, Firefox) y Windows Update |
| 🗄️ **Archivos Gigantes** | Escaneo hiperrápido que encuentra el Top 50 de archivos >100MB |

### ✅ Funcionalidades base

- 🔍 **Escaneo recursivo inteligente** — Node.js, Python, Rust, C#/.NET, Java, Git
- 📁 **Selector de carpetas nativo de Windows** — Diálogo del sistema vía PowerShell
- 🗂️ **Explorador visual de directorios** — Fallback automático
- ✅ **Selección múltiple + action bar sticky** — Limpieza masiva en una pasada
- 📊 **Estadísticas en tiempo real** — Recuperable, detectados, liberado hoy e histórico
- ⚡ **Accesos rápidos** — Usuario, Descargas, Documentos
- 🔒 **Protección contra raíz de disco** — Bloqueo en backend

---

## ⚙️ Arquitectura

```
[ Electron (main.js) ]
  └── Lanza Express server internamente
       │
       ▼
[ Express Server (server.js) ]
  ├── GET  /api/browse            → Lista carpetas del sistema de archivos
  ├── GET  /api/pick-folder       → Abre el diálogo nativo de Windows (PowerShell STA)
  ├── POST /api/scan              → Escaneo recursivo con detección de firmas de tecnología
  ├── POST /api/delete            → Elimina carpetas validadas por lista blanca
  ├── GET  /api/system/scan       → Detecta cachés de Chrome, Edge, Firefox y Windows
  ├── POST /api/system/delete     → Ejecuta borrado seguro de sistema (incluye Docker Prune)
  ├── POST /api/scan-large-files  → Algoritmo concurrente para detectar archivos > 100MB
  └── GET/POST /api/settings      → Gestiona el archivo de config.json y Whitelist

[ UI Web (public/) ]
  ├── index.html  → Estructura: modales, tabla, filtros, vista Archivos Gigantes
  ├── style.css   → Tema dark SaaS completo
  └── app.js      → Lógica: escaneo, filtros, gráfico, historial, Settings UI
```

**Optimizaciones técnicas:**
- **Pruning**: El crawler nunca desciende en `node_modules`, `.git`, `AppData`, `Windows`, etc.
- **Concurrencia limitada**: Máx. 40 operaciones I/O paralelas para evitar `EMFILE`.
- **Validación doble**: Lista blanca de nombres + padre no puede ser raíz del disco.
- **Auto-refresh**: Tras una limpieza, el escaneo se repite automáticamente.

---

## 🔒 Carpetas Limpiables (Safe-List)

| Directorio | Tecnología | Cómo regenerar |
| :--- | :--- | :--- |
| `node_modules` | Node.js / npm | `npm install` |
| `venv`, `.venv`, `env` | Python | `pip install -r requirements.txt` |
| `target` | Rust | `cargo build` |
| `bin`, `obj` | C# / .NET | `dotnet build` |
| `dist`, `build` | Frontend / empaquetadores | `npm run build` |
| `.next`, `.nuxt` | Next.js / Nuxt.js | `npm run build` |
| `__pycache__`, `.pytest_cache` | Python | Automático |
| `.cache`, `.parcel-cache` | Parcel / Webpack | Automático |
| `.gradle` | Java / Gradle | Automático |

---

## 🚀 Cómo Usar

### Opción 1 — Ejecutable (.exe) ⭐ Recomendado
1. Andá a la carpeta `dist\CleanSweep Dev v2-win32-x64\`
2. Abrí **`CleanSweep Dev v2.exe`** directamente
3. No necesitás tener Node.js instalado — Electron incluye todo el runtime

> **Nota**: Windows SmartScreen puede mostrar un aviso la primera vez por ser un ejecutable no firmado. Hacé clic en **"Más información" → "Ejecutar de todas formas"**.

### Opción 2 — Modo web (requiere Node.js)

**Ejecución rápida (Windows)**
```
Doble clic en iniciar.bat
```
Instala dependencias automáticamente y abre el navegador.

**Ejecución manual**
```bash
npm install
npm start
```
Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

### Opción 3 — Modo Electron (desarrollo)
```bash
npm install
npm run electron:dev
```

---

## 🛠️ Generar el .exe

```bash
npm install
npx electron-packager . "CleanSweep Dev v2" --platform=win32 --arch=x64 --out=dist --overwrite --icon=public/icon.ico --ignore=dist
```

El resultado queda en `dist\CleanSweep Dev v2-win32-x64\`. Comprimí esa carpeta en ZIP para distribuirla.

---

## 🗂️ Estructura del Proyecto

```
Sistema de borrado v2/
├── main.js            ← Entry point de Electron
├── server.js          ← Backend Express con todos los endpoints API
├── iniciar.bat        ← Lanzador web con instalación automática (Windows)
├── package.json
├── dist/              ← App empaquetada (.exe)
└── public/
    ├── index.html     ← Estructura: modales, tabla, filtros, stats, gráfico
    ├── style.css      ← Tema dark SaaS completo con todas las utilidades
    ├── app.js         ← Lógica: escaneo, filtros, gráfico, historial, borrado
    ├── icon.ico       ← Ícono de la app
    └── favicon.svg
```

---

## 📋 Requisitos

- **Para el .exe**: Solo Windows 10/11 — sin dependencias adicionales
- **Para modo web/dev**: Node.js `>= 14.0.0` + Windows (selector nativo de carpetas)
