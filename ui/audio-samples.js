// The authoritative catalogue and mix recipes are audio/manifest.json.
// The offline builder validates provenance/hashes, then embeds each mix ONCE.
// Cues reference stable sample IDs; archives/original uploads are not duplicated.
const SFX_ASSETS = Object.freeze(/* @audioAssets */ {});
const SOUND_SAMPLES = Object.freeze(/* @audioCues */ {});
const SFX_CREDITS = Object.freeze(/* @audioCredits */ {});
