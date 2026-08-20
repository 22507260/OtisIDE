# Contributing

Thanks for helping improve OtisIDE.

## Requirements

- Node.js 20+
- npm 10+
- Git

## Local setup

```bash
git clone https://github.com/22507260/OtisIDE.git
cd OtisIDE
npm ci
```

## Useful scripts

```bash
npm run dev
npm run electron:dev
npm run typecheck
npm run build
npm run electron:build
```

## Build notes

- Web development and `npm run build` work cross-platform.
- Desktop packaging currently targets Windows and writes installer artifacts to `release/`.
- The repository already includes generated icon assets in `build/`, so a fresh clone can package the desktop app without manually regenerating icons first.

## Before opening a PR

- Run `npm run typecheck`
- Run `npm run build`
- Include screenshots when the change affects the UI
