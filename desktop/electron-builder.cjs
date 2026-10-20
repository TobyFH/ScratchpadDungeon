module.exports = {
  appId: "com.scratchpaddungeon.game",
  productName: "Scratchpad Dungeon",
  directories: { output: "dist/desktop" },
  asar: true,
  npmRebuild: false,
  files: [
    "index.html",
    "desktop/main.cjs",
    "desktop/preload.cjs",
    "package.json",
    "assets/**/*.md",
    "assets/**/*.txt",
  ],
  extraMetadata: { main: "desktop/main.cjs" },
  linux: {
    category: "Game",
    executableName: "scratchpad-dungeon",
    target: ["zip"],
    artifactName: "Scratchpad-Dungeon-${version}-${arch}-linux.${ext}",
  },
  win: {
    target: ["zip"],
    artifactName: "Scratchpad-Dungeon-${version}-${arch}-windows.${ext}",
  },
  compression: "normal",
};
