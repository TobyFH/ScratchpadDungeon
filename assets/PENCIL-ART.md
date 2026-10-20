# Pencil illustration set

Created for Scratchpad Dungeon with OpenAI image generation on 21 October 2026, using a scratchy graphite sketchbook direction: uneven contours, cross-hatching, soft rubbed shading and detailed fantasy subjects. These are generated illustrations, not a claim of hand-drawn authorship. No separate project artwork licence has been supplied.

The transparent sprite sheets in `images/pencil/` are losslessly encoded WebP assets. The original generated PNGs were left in the execution workspace; this directory contains the complete game-ready artwork. Existing SVG placeholders remain at their original manifest paths.

Each existing icon, portrait, corpse, floor and trap ID resolves through an `atlas` frame in `data/assets.json`. Frame coordinates crop at display time; the source images are not cut into hundreds of separate files. Hero portraits have healthy, bruised and wounded drawings. Enemies have an additional near-defeat sheet. Injury marks, condition badges, corpse markers and all existing action effects remain functional.

To replace one drawing, use the normal `assets:replace` command for that existing ID. It switches the entry to a standalone image. To replace a complete sheet, retain its dimensions and layout or update the affected frame coordinates. Sprite sheets are embedded once in the standalone HTML and shared through local Blob URLs at runtime, so repeated slot symbols do not duplicate the image data in the DOM.
