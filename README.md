# Paperdesk — browser PDF editor

[Open Paperdesk](https://puwupuwu.github.io/chatgpt/)

A browser-local PDF workspace. Open a PDF, add text, highlight regions, draw signatures, rotate/reorder/delete pages, undo/redo, and export a real PDF. Files never leave the browser.

## Run
Requires Node.js 22 or newer.
```sh
npm install
npm run dev
```
`npm run build` creates a static site in `dist/`. `npm test` runs PDF export tests; `npm run test:e2e` runs Chromium browser tests (install with `npx playwright install chromium`).

## GitHub
CI builds, tests export behavior, runs browser tests, and uploads the built site as an Actions artifact. The Pages workflow deploys the site after tests pass on every push to main; it also supports manual runs. GitHub Pages uses **GitHub Actions** as its source.

## Edit existing content
Choose **Edit text** (the default mode), then click text to place a cursor directly on the page. Type, use arrow keys, delete individual letters, or select words; **Done** or **Ctrl/⌘+Enter** commits the edit, and **Escape** cancels it. Native text undo works while typing. Inline editing reuses the original font when the new characters exist in it, and preserves existing line starting positions; otherwise a substitute font is used. Choose **Edit objects** to select an image, stamp, or vector drawing on the page (or use the Page objects list). Change X/Y/width/height, replace an image, or delete the selected object. Text editing is separate: text mode excludes images/shapes from hit testing and has no drag or resize handles. The Page text list also opens the inline editor, including for hard-to-click text blocks. Drag objects to move them and drag the corner to resize. Use **+ Image** for PNG/JPEG insertion, **Replace image** to swap a selected image, and **+ Shape** for a rectangle. Undo/redo includes content edits.

Content editing replays PDF painting operations into a new vector PDF: the selected operation is changed or omitted, not covered with a white rectangle. Images remain image objects and vectors remain vectors. PDF drawing operations may represent a whole text block or one component of a shape. Original clipping and transparency groups still apply, so clipped objects may not move outside their clipping region. Text inside scans or converted to outlines is not editable as text; OCR is not included. Replacement text uses the selected standard font with Unicode fallback, rather than guaranteeing the original embedded font or automatic paragraph reflow. Content editing flattens interactive fields/annotations and does not retain bookmarks, links, digital signatures or document-level metadata; retain the original.

## Licensing
Paperdesk is AGPL-3.0-or-later and includes MuPDF.js from Artifex under that license. The running app links to its corresponding public source. MuPDF's upstream source is https://github.com/ArtifexSoftware/mupdf/tree/1.28.1/platform/wasm . Other dependencies retain their licenses.

## Scope
**Add text** creates annotations; **Edit text** / **Edit objects** rewrites existing page content. Highlights are visual annotations, not redaction. Signatures are freehand ink, not cryptographic signatures. Added text uses Helvetica for Western Latin characters and embedded Noto Sans Georgian for Georgian. Encrypted/password-protected PDFs are rejected. Exports flatten new annotations into page content. Embedded original content is preserved, but document-level features such as bookmarks, digital signatures, and interactive forms are not guaranteed by page copying. Export a copy and retain your original.

## Georgian text
Georgian Mkhedruli and Mtavruli are supported in added text, replacement text, and direct inline editing. Noto Sans Georgian is automatically embedded when required and is also available in the font selector. The font is bundled with the deployed app; readers do not need to install it. This adds Georgian document text support, not a full Georgian translation of every menu. Scanned text still needs OCR.

## Stamps
Use **Stamps / ბეჭედი** to choose Approved, Received, Copy, or Draft presets, enter custom Georgian/English wording, include a date, or upload a PNG/JPEG seal. Click **Place stamp**, then click the page. Transparent PNGs preserve transparency. Use Edit objects to move, resize, replace, or delete the placed stamp; PDF undo/redo also works.

Stamps are exported as high-resolution images, not digital certificates or searchable text. Up to 12 stamps can be saved in this browser's local storage and removed from the stamp dialog. Saved stamps do not sync between devices; clearing browser storage removes them. Dates are fixed when the stamp is created; changing a preset/date generates a new stamp.

Noto Sans Georgian is distributed under the SIL Open Font License. Font source is pinned to google/fonts commit 8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5; the build bundles its license beside the font at vendor/fonts/OFL.txt.
