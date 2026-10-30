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
Choose **Edit content**, then select text, an image, or a vector drawing on the page (or use the Page objects list). Replace text, choose a replacement font/color/size, change X/Y/width/height, or delete the selected object. Drag objects to move them and drag the corner to resize. Use **+ Image** for PNG/JPEG insertion, **Replace image** to swap a selected image, and **+ Shape** for a rectangle. Undo/redo includes content edits.

Content editing replays PDF painting operations into a new vector PDF: the selected operation is changed or omitted, not covered with a white rectangle. Images remain image objects and vectors remain vectors. PDF drawing operations may represent a whole text block or one component of a shape. Original clipping and transparency groups still apply, so clipped objects may not move outside their clipping region. Text inside scans or converted to outlines is not editable as text; OCR is not included. Replacement text uses the selected standard font with Unicode fallback, rather than guaranteeing the original embedded font or automatic paragraph reflow. Content editing flattens interactive fields/annotations and does not retain bookmarks, links, digital signatures or document-level metadata; retain the original.

## Licensing
Paperdesk is AGPL-3.0-or-later and includes MuPDF.js from Artifex under that license. The running app links to its corresponding public source. MuPDF's upstream source is https://github.com/ArtifexSoftware/mupdf/tree/1.28.1/platform/wasm . Other dependencies retain their licenses.

## Scope
**Add text** creates annotations; **Edit content** rewrites existing page content. Highlights are visual annotations, not redaction. Signatures are freehand ink, not cryptographic signatures. Added text uses the PDF standard Helvetica font (Western Latin characters). Encrypted/password-protected PDFs are rejected. Exports flatten new annotations into page content. Embedded original content is preserved, but document-level features such as bookmarks, digital signatures, and interactive forms are not guaranteed by page copying. Export a copy and retain your original.
