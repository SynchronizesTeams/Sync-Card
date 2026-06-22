# 💳 Sync-Card (ID Card Generator)

Sync-Card is a premium, high-fidelity ID Card SVG generator built with **Astro**, **Tailwind CSS**, and **SQLite**. Designed with a bold, modern **Neubrutalist design system**, it allows users to customize, preview, and generate personalized, SVG-based digital ID cards perfect for embedding directly in GitHub READMEs, personal portfolios, or websites.

![Sync-Card Preview Screenshot](public/favicon.svg)

---

## ✨ Features

- **🎨 Neubrutalist Aesthetics:** Bold typography (Poppins & Space Mono), heavy black borders, solid drop shadows, and vibrant accent colors.
- **🖼️ Real-time SVG Generator API:** Serve cards dynamically via `/api/card.svg?params` with customizable details.
- **🖱️ Direct Drag & Zoom Adjustments:** Drag your photo directly on the live preview box to pan, and use the mouse scroll wheel to zoom in/out for the perfect crop.
- **💡 Light & Dark Mode:** Swap layouts on-the-fly with a single checkbox toggle.
- **📐 Dual Layouts:** Supports both **Portrait** (tall) and **Landscape** (wide) formats.
- **🔗 Smart QR Code Integration:** Dynamically generated QR codes matching your destination URL (e.g., GitHub profile, portfolio).
- **🏷️ Customizable Metadata:**
  - Name (with auto-wrap protection for long names)
  - Subtitle / Role
  - Dynamic Tags (comma-separated badges)
  - Custom Instagram & Website URLs
  - Customizable Avatar Photo Frame background color
- **💾 Persistent Image Uploads:** Option to upload your custom avatar photo which is processed, optimized, and saved in a local SQLite database (`images.db`) and served securely.

---

## 🛠️ Tech Stack

- **Framework:** [Astro](https://astro.build/) (Static Site Generator & SSR API Routes)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Database:** [SQLite](https://sqlite.org/) (via `better-sqlite3` for fast, lightweight local storage)
- **Runtime:** [Bun](https://bun.sh/)

---

## 🚀 Getting Started

### Prerequisites

You will need [Bun](https://bun.sh/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SynchronizesTeams/Sync-Card.git
   cd Sync-Card
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run the development server:
   ```bash
   bun dev
   ```

4. Open your browser and navigate to `http://localhost:4321` to access the customization dashboard.

---

## ⚙️ SVG API Parameters

You can embed the SVG directly into your markdown or HTML files. The `/api/card.svg` endpoint accepts the following query parameters:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `nama` | `string` | `John Doe` | The name to be displayed on the card. |
| `role` | `string` | `Software Engineer` | Subtitle/position title. |
| `qr` | `string` | `https://github.com/johndoe` | URL encoded destination for the QR code. |
| `gambar` | `string` | *(default)* | URL of the avatar image or a reference ID (e.g., `db:id`). |
| `img_scale`| `float`| `1.33` | Scale factor for zooming the avatar image. |
| `img_x` | `integer`| `-26` | Horizontal offset in pixels for panning the avatar. |
| `img_y` | `integer`| `0` | Vertical offset in pixels for panning the avatar. |
| `img_bg` | `hex` | `fca2a2` | Background hex color for the avatar frame (exclude `#`). |
| `tags` | `string` | `HTML, CSS, JS` | Comma-separated list of tags/skills. |
| `ig` | `string` | `@johndoe` | Instagram handle. |
| `website` | `string` | `johndoe.com` | Personal/portfolio website domain. |
| `dark` | `boolean`| `false` | Enable dark theme colors (`true`/`false`). |
| `landscape`| `boolean`| `false` | Use wide landscape orientation (`true`/`false`). |

### Markdown Embed Example

```markdown
![My ID Card](https://card.synchronizeteams.com/api/card.svg?nama=John+Doe&role=Software+Engineer&dark=true)
```

---

## 📂 Project Structure

```text
sync-card/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   ├── card.svg.ts    # SVG generation engine
│   │   │   └── upload.ts      # SQLite avatar upload handler
│   │   └── index.astro        # Neubrutalist configuration dashboard
│   ├── layouts/               # Basic layout components
│   └── components/            # Reusable Astro templates
├── public/                    # Static assets & user uploads
├── images.db                  # Local SQLite database (git-ignored)
├── tsconfig.json              # TypeScript configuration
└── astro.config.mjs           # Astro project configuration
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
