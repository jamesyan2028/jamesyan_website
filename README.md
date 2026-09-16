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

