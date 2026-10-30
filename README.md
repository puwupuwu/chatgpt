# Paperdesk — browser PDF editor

A private, browser-local PDF workspace. Open a PDF, add text, highlight regions, draw signatures, rotate/reorder/delete pages, undo/redo, and export a real PDF. Files never leave the browser.

## Run
Requires Node.js 22 or newer.
```sh
npm install
npm run dev
```
`npm run build` creates a static site in `dist/`. `npm test` runs PDF export tests; `npm run test:e2e` runs Chromium browser tests (install with `npx playwright install chromium`).

## GitHub
CI builds, tests export behavior, runs browser tests, and uploads the built site as an Actions artifact. A separate manually triggered Pages workflow deploys the site after tests pass. Enable GitHub Pages with source **GitHub Actions** in repository settings first. Private repository Pages availability depends on the account plan; published Pages may be public, so check the selected audience.

## Scope
Text is added as an overlay; existing PDF text is not rewritten. Highlights are visual annotations, not redaction. Signatures are freehand ink, not cryptographic signatures. Added text uses the PDF standard Helvetica font (Western Latin characters). Encrypted/password-protected PDFs are rejected. Exports flatten new annotations into page content. Embedded original content is preserved, but document-level features such as bookmarks, digital signatures, and interactive forms are not guaranteed by page copying. Export a copy and retain your original.
