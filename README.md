# Vietnam Trip Site v4 - Google Places

Static GitHub Pages travel site with:
- Home page
- Google Places-powered interactive map
- Separate itinerary page
- Search and filters
- Google Maps links
- Google Places photos/ratings/addresses when available
- Local browser comments saved with localStorage

## Important: GitHub Secret

You said you added a GitHub Actions secret named:

`GOOGLE_API_KEY`

This project includes `.github/workflows/deploy.yml`, which writes that secret into `js/config.js` at deploy time.

## GitHub Pages setup

Use GitHub Actions deployment, not “Deploy from branch”:

1. Repo -> Settings -> Pages
2. Source: GitHub Actions
3. Push this repo to `main`
4. Go to Actions and run/check `Deploy GitHub Pages`

## Required Google APIs

Enable:
- Maps JavaScript API
- Places API / Places Library

Restrict the key:
- HTTP referrers: `https://YOUR_USERNAME.github.io/*`
- APIs: Maps JavaScript API and Places API only
- Set tight quotas/budget alerts if you want to avoid spend

## Local testing

Copy:

`js/config.example.js`

to:

`js/config.js`

Then replace the placeholder with your local test key.

## Notes

- Comments save only to the current browser/device. Shared comments require a backend.
- Google Places photos load only after clicking a marker or list item.
- External links such as Airbnb/ticket pages skip Places lookup to avoid unnecessary API requests.
- Some coordinates are still approximate; Google Places details help but do not replace final manual verification.
