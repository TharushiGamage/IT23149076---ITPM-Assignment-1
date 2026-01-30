# IT23149076 — UI Test Suite

**University assignment — UI automation using Playwright** ✅

---

## Overview
This repository contains an end-to-end UI test suite built with Playwright for the translator project. The tests are structured for a university assignment; replace the placeholders below with your **Gamage K.D.T.D**, **IT23149076**, 

## Table of contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Run tests](#run-tests)
- [View reports & results](#view-reports--results)
- [Project structure](#project-structure)
- [Submission guidelines](#submission-guidelines)
- [Author](#author)

---

## Prerequisites
- Node.js (recommend >=16)
- npm or yarn
- Playwright (installed via npm)

## Setup
1. Install dependencies:

```bash
npm install
# or
# yarn
```

2. Install Playwright browsers:

```bash
npx playwright install --with-deps
```

## Run tests
- Run all tests:

```bash
npx playwright test
# or if there's an npm script
npm test
```

- Run a single test file:

```bash
npx playwright test tests/IT23149076_ui.spec.js
```

- Run a single test by title:

```bash
npx playwright test -g "<test name regex>"
```

## View reports & results
- HTML report (generated in `playwright-report`):

```bash
npx playwright show-report
# or open playwright-report/index.html in your browser
```

- Raw test artifacts and traces are in the `test-results/` folder.

## Project structure
- `tests/` — Playwright test files
- `playwright.config.cjs` — Playwright configuration
- `playwright-report/` — generated HTML reports
- `test-results/` — per-run test artifacts

- Preferred commit message format: `Assignment: IT23149076 - <Gamage K.D.T.D> - <IT23149076>`
- Zip the repository or provide the GitHub link per your lecturer's instructions.
