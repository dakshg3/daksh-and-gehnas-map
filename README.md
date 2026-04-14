# Our Story Map

A romantic, gift-worthy memory map that visualizes a couple’s photos on an interactive world map.

- **Static, frontend-focused** Next.js app (no backend)
- Data loaded from a local JSON file
- Photos stored locally in `public/photos/`

## Features

- **Preprocessing script**: scan photos, extract EXIF date + GPS, reverse-geocode to a place name, and write `data/memories.json`
- **Metadata Review UI** (`/review`): edit date, caption, and location (search or click to drop a pin)
- **Interactive Story Map** (`/map`): clustered heart pins, memory modal, optional chronological path

## Add photos

1. Put images into:

   - `public/photos/`

2. (Optional) commit them if you want deployment to include the images.

## Generate `memories.json` from EXIF

Run the extractor:

- `npm run memories:extract`

Output:

- `data/memories.json`

Then copy it to the static public path (the UI fetches `/data/memories.json`):

- `cp data/memories.json public/data/memories.json`

If metadata is missing, entries will be created with empty/null fields and `needsReview: true`.

## Run the app

- `npm run dev`

Open:
- Home: `http://localhost:3000`
- Review: `http://localhost:3000/review`
- Map: `http://localhost:3000/map`

## Update metadata

Use `/review` to fix missing dates/locations and add captions.

When done, click **Download updated memories.json** and replace:
- `public/data/memories.json`

(Optionally keep `data/memories.json` in sync too.)

## Deploy (Vercel)

This app is static-friendly.

1. Push the repo to GitHub.
2. Import into Vercel.
3. Build command: `npm run build`
4. Output: Next.js default.

Make sure `public/photos/` and `public/data/memories.json` are included in the repository so Vercel can serve them.
