# James Yan — Portfolio

A single-page portfolio in the style of pear.no: a full-screen scroll-scrubbed
video background (built from your `frames_intro` sequence) with three glass
text panels that fade in and out as you scroll — intro, experience/projects,
and contact.

## Files

```
index.html      structure + copy (edit your name, bio, experience, links here)
style.css       all styling (colors, type, layout — tokens at the top)
script.js       preloads the frames and drives the scroll-scrub + fades
frames/         234 .webp frames extracted from your video
```

## Before you publish — replace the placeholders

Open `index.html` and swap out:

- **Email address** — `james.yan2028@gmail.com`
- **GitHub / LinkedIn URLs** — currently `yourusername`
- **Résumé** — the link points to `resume.pdf`; drop your actual résumé PDF
  into this folder with that name, or update the `href`
- **Experience & Projects** — everything in `[brackets]` in the "Selected
  work" section is a placeholder (company names, roles, research focus,
  project names/descriptions). Replace with your real history; keep each
  description to one or two lines so it stays legible over the video.
- **Wordmark / footnote** — "James Yan" appears in the header and
  footer; update if you go by something else.

## Running it locally

Because the page loads 234 separate image files, opening `index.html`
directly by double-clicking can be blocked by some browsers. The reliable
way to preview it is a tiny local server from inside this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Hosting it for real

This is a fully static site — no build step, no backend. Any static host
works: drag the whole folder into Netlify or Vercel, or push it to a GitHub
repo and enable GitHub Pages. Just make sure the `frames/` folder is
deployed alongside `index.html`.

## Tuning the scroll feel

In `script.js`:

- `PX_PER_FRAME` (currently `16`) controls how much you have to scroll per
  video frame — raise it for a slower, longer scroll; lower it for a
  quicker one.
- `BUBBLES_CONFIG` controls exactly when each text panel fades in and out,
  as fractions (0–1) of the total scroll distance.
