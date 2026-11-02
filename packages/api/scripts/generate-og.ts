#!/usr/bin/env bun
/**
 * One-off: generate packages/web/public/og.png (1200x630) — the Open Graph
 * share image used by index.html. Run with `bun scripts/generate-og.ts`
 * from packages/api (sharp comes from packages/api).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const OUT = resolve(import.meta.dir, '../../web/public/og.png');

// Brand: matches PWA background_color (#f7f1e7) and theme_color (#2e7d32).
// Centered shopping cart icon built with simple paths so we don't need an
// external font or icon font installed.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f7f1e7" />
            <stop offset="1" stop-color="#e6d8bd" />
        </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#g)" />
    <g transform="translate(380,110)" fill="#2e7d32">
        <path d="M0 50 L20 50 L60 220 L260 220 L300 90 L80 90" fill="none" stroke="#2e7d32" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="115" cy="270" r="20" fill="#2e7d32" />
        <circle cx="225" cy="270" r="20" fill="#2e7d32" />
        <rect x="100" y="110" width="40" height="40" rx="6" fill="#fff" stroke="#2e7d32" stroke-width="6"/>
        <path d="M108 130 L120 142 L138 122" fill="none" stroke="#2e7d32" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="155" y="110" width="40" height="40" rx="6" fill="#fff" stroke="#2e7d32" stroke-width="6"/>
        <path d="M163 130 L175 142 L193 122" fill="none" stroke="#2e7d32" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="210" y="110" width="40" height="40" rx="6" fill="#fff" stroke="#2e7d32" stroke-width="6"/>
        <path d="M218 130 L230 142 L248 122" fill="none" stroke="#2e7d32" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="600" y="500" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="120" font-weight="700" fill="#2e7d32">Tandra</text>
    <text x="600" y="565" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="500" fill="#3f3f3f">Shared shopping lists, recipes &amp; meal plans</text>
</svg>
`.trim();

const buf = Buffer.from(svg);

mkdirSync(dirname(OUT), { recursive: true });

const png = await sharp(buf).png().toBuffer();

writeFileSync(OUT, png);

console.log(`Wrote ${OUT} (${png.length} bytes)`);
