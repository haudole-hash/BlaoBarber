/**
 * BLaoBarber desktop app (Electron)
 */
const { app, BrowserWindow, dialog, Tray, Menu, nativeImage } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.PORT) || 3847;
const APP_URL = `http://127.0.0.1:${PORT}`;

const isPackaged = app.isPackaged;
const appRoot = isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.join(__dirname, "..");
const nodeExe = isPackaged
  ? path.join(process.resourcesPath, "node", "node.exe")
  : process.execPath;

let serverProc = null;
let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

function checkServerUp() {
  return new Promise((resolve) => {
    const req = http.get(`${APP_URL}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      checkServerUp().then((ok) => {
        if (ok) resolve();
        else schedule();
      });
    };
    const schedule = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Khong khoi dong duoc may chu. Thu tat app va mo lai."));
      } else {
        setTimeout(tryOnce, 350);
      }
    };
    tryOnce();
  });
}

function startServer() {
  if (isPackaged) {
    if (!fs.existsSync(nodeExe)) throw new Error(`Thieu Node: ${nodeExe}`);
    const script = path.join(appRoot, "dist-server", "index.cjs");
    if (!fs.existsSync(script)) throw new Error(`Thieu server: ${script}`);
    serverProc = spawn(nodeExe, [script], {
      cwd: appRoot,
      env: { ...process.env, BLAO_APP_ROOT: appRoot, PORT: String(PORT), BLAO_NO_BROWSER: "1" },
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  const script = path.join(appRoot, "server", "index.ts");
  serverProc = spawn(nodeExe, ["--import", "tsx", script], {
    cwd: appRoot,
    env: { ...process.env, BLAO_APP_ROOT: appRoot, PORT: String(PORT), BLAO_NO_BROWSER: "1" },
    stdio: "inherit",
    shell: true,
  });
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: "#f8f9fa",
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

async function createTray() {
  if (tray) return;
  let icon;
  try {
    icon = await app.getFileIcon(process.execPath, { size: "small" });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("B'Lao - Dang chay (bam de mo lai)");
  tray.on("double-click", () => showApp());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mo ung dung", click: () => showApp() },
      { type: "separator" },
      {
        label: "Thoat hoan toan",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function showApp() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    title: "B'Lao - Quan ly tiem",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.loadURL(APP_URL);
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProc.pid), "/f", "/t"], { windowsHide: true });
      } else {
        serverProc.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
    serverProc = null;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", async () => {
    const up = await checkServerUp();
    if (up) {
      showApp();
      return;
    }
    if (up && !mainWindow) {
      createWindow();
    }
  });
}

app.whenReady().then(async () => {
  try {
    const alreadyRunning = await checkServerUp();
    if (alreadyRunning) {
      await createTray();
      createWindow();
      return;
    }

    createSplash();
    startServer();
    await waitForServer();
    await createTray();
    createWindow();
  } catch (err) {
    closeSplash();
    dialog.showErrorBox("B'Lao - Loi", String(err.message ?? err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    stopServer();
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
  if (tray) tray.destroy();
});
