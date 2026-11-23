const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require("electron");
const path = require("node:path");
const { startRuntime } = require("./runtime.cjs");

app.setName("SearchAnvil");

let window;
let runtime;
let starting;
let failure;
let quitting = false;
let shutdownComplete = false;

function isApplicationUrl(url) {
  try {
    return Boolean(runtime) && new URL(url).origin === runtime.origin;
  } catch {
    return false;
  }
}

function installMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "SearchAnvil",
        submenu: [
          { role: "about", label: "About SearchAnvil" },
          {
            label: "Settings…",
            accelerator: "Cmd+,",
            click: () => {
              if (window && runtime) void window.loadURL(runtime.origin + "/app/settings");
            },
          },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "windowMenu" },
    ]),
  );
}

function configureSession(profile) {
  profile.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  profile.setPermissionCheckHandler(() => false);
  profile.webRequest.onBeforeRequest((details, callback) => {
    callback({
      cancel: details.webContentsId !== window?.webContents.id || !isApplicationUrl(details.url),
    });
  });
  profile.webRequest.onBeforeSendHeaders((details, callback) => {
    if (
      !runtime ||
      details.webContentsId !== window?.webContents.id ||
      !isApplicationUrl(details.url)
    ) {
      callback({ cancel: true });
      return;
    }
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        "X-SearchAnvil-Window": runtime.capability,
      },
    });
  });
  profile.on("will-download", (event, item, contents) => {
    if (
      contents !== window?.webContents ||
      !isApplicationUrl(item.getURL()) ||
      item.getMimeType() !== "text/csv" ||
      !new URL(item.getURL()).pathname.startsWith("/desktop-api/api/v1/")
    ) {
      event.preventDefault();
      return;
    }
    item.setSaveDialogOptions({
      title: "Export SearchAnvil report",
      defaultPath: item.getFilename(),
    });
  });
}

function openWindow(profile) {
  if (window) {
    window.focus();
    return;
  }
  if (!runtime || quitting || failure) return;
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 820,
    minHeight: 600,
    show: false,
    backgroundColor: "#080b0e",
    webPreferences: {
      session: profile,
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const restrict = (event, details) => {
    const destination = typeof details === "string" ? details : details.url;
    if (!isApplicationUrl(destination)) event.preventDefault();
  };
  window.webContents.on("will-navigate", restrict);
  window.webContents.on("will-frame-navigate", restrict);
  window.webContents.on("will-redirect", restrict);
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.on("closed", () => {
    window = undefined;
  });
  window.once("ready-to-show", () => window?.show());
  void window.loadURL(runtime.origin + "/app/projects").catch(runtimeFailed);
}

function runtimeFailed(error) {
  if (failure || quitting) return;
  failure = error;
  dialog.showErrorBox(
    "SearchAnvil local runtime stopped",
    `${error.message}\n\nYour local data remains in ${app.getPath("userData")}. Relaunch SearchAnvil to retry.`,
  );
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => window?.focus());
  app.on("before-quit", (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void Promise.resolve(starting)
      .then((instance) => instance?.stop())
      .catch(() => {})
      .finally(() => {
        shutdownComplete = true;
        app.quit();
      });
  });
  app
    .whenReady()
    .then(async () => {
      if (quitting) return;
      installMenu();
      const profile = session.fromPartition("persist:searchanvil");
      configureSession(profile);
      ipcMain.handle("searchanvil:status", (event) => {
        if (
          event.sender !== window?.webContents ||
          event.senderFrame !== event.sender.mainFrame ||
          !isApplicationUrl(event.senderFrame?.url)
        ) {
          throw new Error("The runtime status is available only to the application window.");
        }
        return { runtime: "ready", storage: "local", version: app.getVersion() };
      });

      app.on("activate", () => openWindow(profile));
      const resources = app.isPackaged
        ? path.join(process.resourcesPath, "runtime")
        : path.join(__dirname, "build", "runtime");
      starting = startRuntime(resources, app.getPath("userData"), runtimeFailed);
      runtime = await starting;
      openWindow(profile);
    })
    .catch(runtimeFailed);
}
