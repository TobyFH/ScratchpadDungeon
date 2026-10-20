"use strict";
const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("node:path"),
  { pathToFileURL } = require("node:url");
app.setName("Scratchpad Dungeon");
let window;
const isDeck =
  process.env.SteamDeck === "1" ||
  process.env.STEAM_DECK === "1" ||
  process.argv.includes("--steam-deck");
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  const entry = path.join(app.getAppPath(), "index.html"),
    allowed = pathToFileURL(entry).href;
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    fullscreen: isDeck,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#302d23",
    title: "Scratchpad Dungeon",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: ["--scratchpad-deck=" + String(isDeck)],
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== allowed) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.once("ready-to-show", () => window.show());
  window.loadFile(entry);
  ipcMain.handle("scratchpad:fullscreen", (event) => {
    if (event.sender !== window?.webContents) return false;
    window.setFullScreen(!window.isFullScreen());
    return window.isFullScreen();
  });
  ipcMain.handle("scratchpad:quit", (event) => {
    if (event.sender === window?.webContents) app.quit();
  });
  if (process.env.SCRATCHPAD_SMOKE_TEST === "1")
    window.webContents.once("did-finish-load", async () => {
      try {
        const result = await window.webContents.executeJavaScript(
          `({title:document.title,tiles:document.querySelectorAll('[data-tile]').length,offline:__PRODUCTION_DATA__.assets.every(a=>a.url.startsWith('data:')),node:typeof require,deck:document.body.dataset.deck,services:!!Production.input&&!!Production.audio})`,
        );
        console.log("SCRATCHPAD_DESKTOP_SMOKE " + JSON.stringify(result));
        app.exit(
          result.tiles === 99 &&
            result.offline &&
            result.node === "undefined" &&
            result.services
            ? 0
            : 1,
        );
      } catch (e) {
        console.error(e);
        app.exit(1);
      }
    });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
