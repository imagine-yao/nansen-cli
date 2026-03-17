---
"nansen-cli": patch
---

fix: include src subdirectories in npm package

The `files` field in package.json used `src/*.js` which only matched files directly in `src/`, causing `src/commands/` to be missing from the 1.18.0 publish. Changed to `src/**/*.js` to include all subdirectories recursively, and added `!src/__tests__/**` to exclude test files from the package.
