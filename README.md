# Document Tracking System

A simple tracker for **travel orders**, **office orders** and **communication letters** (incoming and outgoing), built for DA-PRDP RPCO 13. It is plain HTML, CSS and JavaScript, so there is nothing to install or build.

## Features
- Auto-numbered documents: `TO-2026-0001`, `OO-2026-0001`, `CL-2026-0001`
- Fields specific to each document type
- Routing history: record each forward, receipt, signature, release, return or filing
- Status chips, overdue flag, search and filters
- Printable routing slip
- Export to CSV (opens in Excel), plus JSON backup and restore

## Run it
Open `index.html` in a browser.

## Publish on GitHub Pages
1. Create a new repository and upload all files, keeping the `css` and `js` folders.
2. Go to **Settings > Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
3. Your site will be at `https://<username>.github.io/<repository>/`.

## Where the data is kept
Records are saved in the browser's local storage, on that computer only. They are **not** uploaded to GitHub, even when the site is published. Use **Backup** regularly and **Restore** to move records to another computer. Clearing the browser's site data deletes the records.

## Files
- `index.html` – page layout
- `css/styles.css` – styles and print rules
- `js/app.js` – data, routing and export logic
