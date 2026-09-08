# Yacinix Visuals — Portfolio

Site one-page d'un monteur vidéo publicitaire freelance.
Statique, sans étape de build : `index.html`, `style.css`, `script.js`.

## Aperçu local

Ouvrir `index.html` dans un navigateur, ou servir le dossier
(les embeds YouTube exigent un serveur http, pas `file://`) :

```bash
python -m http.server 8000
# http://localhost:8000
```

## À compléter

- `images/` : vignettes `thumb-01..06.jpg`, `result-*.jpg`, `og-cover.jpg`
- `VIDEO_ID` du showreel dans `index.html`
- `YOUR_FORM_ID` (Formspree) dans le formulaire de contact
- Vrais témoignages dans la section Reviews

## Déploiement

Hébergé sur Netlify. Chaque `git push` sur la branche `main`
redéploie le site automatiquement.
