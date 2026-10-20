"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "ScratchpadDesktop",
  Object.freeze({
    platform: process.platform,
    isSteamDeck: process.argv.includes("--scratchpad-deck=true"),
    toggleFullscreen: () => ipcRenderer.invoke("scratchpad:fullscreen"),
    quit: () => ipcRenderer.invoke("scratchpad:quit"),
  }),
);
