// Spectator pacing is independent of reel outcomes and gameplay RNG. A manual
// click always works immediately; only automated confirmation waits to read.
const AUTOMATION_PACING = Object.freeze({
  encounter: 1500,
  dual: 1800,
  choice: 1100,
  reward: 1100,
  shop: 700,
  memorial: 1500,
  opening: 680,
  minimum: 320,
});
let automaticReading = null,
  automaticReadPausedAt = null;
function automaticReadDelay(kind = "reward") {
  const referenceSpeed = skip ? 5 : pace();
  const base =
    kind === "enemy-intro"
      ? battleEnemies().length > 1
        ? AUTOMATION_PACING.dual
        : AUTOMATION_PACING.encounter
      : ["death", "burial"].includes(kind)
        ? AUTOMATION_PACING.memorial
        : kind === "shop"
          ? AUTOMATION_PACING.shop
          : kind === "opening"
            ? AUTOMATION_PACING.opening
            : kind === "choice"
              ? AUTOMATION_PACING.choice
              : AUTOMATION_PACING.reward;
  return Math.max(AUTOMATION_PACING.minimum, base / Math.sqrt(referenceSpeed));
}
function automaticConfirmReady(button, kind = "reward") {
  if (!button || button.disabled || utilityOpen || document.hidden)
    return false;
  if (
    !automaticReading ||
    automaticReading.button !== button ||
    automaticReading.run !== state
  )
    automaticReading = { button, run: state, shownAt: performance.now() };
  return (
    performance.now() - automaticReading.shownAt >= automaticReadDelay(kind)
  );
}
function pauseAutomaticReading() {
  automaticReadPausedAt ??= performance.now();
}
function resumeAutomaticReading() {
  if (automaticReading && automaticReadPausedAt !== null)
    automaticReading.shownAt += performance.now() - automaticReadPausedAt;
  automaticReadPausedAt = null;
}
async function automaticOpeningPause() {
  if (state.autoresolve || state.autoplay)
    await feedbackPause(automaticReadDelay("opening"));
}
