# paper-card

An ID card generator with the same engine as Sync-Card — `/api/card.svg`, SQLite-backed
uploads, drag/zoom cropping — printed in the "clean light ops paper" design language of
`portooooo`: Fraunces display, JetBrains Mono metadata, hairline rules, one vermilion
accent. No neubrutalist borders, no solid offset shadows.

Astro (SSR, node standalone) + Tailwind CSS v4 + better-sqlite3 + qrcode.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build && node dist/server/entry.mjs
```

## API

`GET /api/card.svg?nama=&role=&qr=&gambar=&img_scale=&img_x=&img_y=&img_bg=&tags=&ig=&website=&dark=&landscape=`

Same parameters and defaults as Sync-Card, plus `brand` (header wordmark, default
`SynchronizeTeams`) and `meta` (corner label, default `ID / SVG`) — pass either as empty
to hide it. The default `img_bg` is paper stock (`F1EDE5`) and the name is not
force-uppercased (serif display). `gambar` accepts a URL, a `data:` URI, or `db:<id>` from
`/api/upload`.

Markdown embedding:

```markdown
![My ID Card](https://your-host/api/card.svg?nama=Adly+Fahreza&role=Sysadmin&dark=true)
```

## Design tokens

`src/styles/global.css` (`@theme`) and the `light`/`dark` objects in
`src/pages/api/card.svg.ts` mirror `portooooo/DESIGN.md`:

| token | value |
| --- | --- |
| paper | `#FAF7F2` |
| paper-2 | `#F1EDE5` |
| ink | `#1C1917` |
| ink-2 | `#57534E` |
| line | `#E2DCD0` |
| accent | `#E4572E` |

Change both places if a token moves.

## Notes

- Uploads and `images.db` live in `~/.paper-card-data` (override with `DATA_DIR`).
- Fonts inside the SVG are Google Fonts `@import`s with serif/mono fallbacks, so a
  sandboxed renderer still gets usable typography instead of system sans.
