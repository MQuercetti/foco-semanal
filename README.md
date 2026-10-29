# Foco Semanal (escritorio)

App de escritorio para Windows. El instalador se genera solo en GitHub.

## Publicar una versión
1. Subí esta carpeta a tu repositorio.
2. En GitHub: **Actions → Publicar instalador de Windows → Run workflow**.
3. A los pocos minutos aparece en **Releases** el archivo `Foco-Semanal-Setup-<versión>.exe` (por ejemplo `Foco-Semanal-Setup-1.3.1.exe`).

## Actualizar la app
1. Cambiá el número de `version` en `package.json` (por ejemplo `1.0.1`).
2. Corré el workflow otra vez. Las apps instaladas se actualizan solas al abrirse.

## Página de descarga
En **Settings → Pages**, elegí la rama `main` y la carpeta `/docs`. El botón de descarga apunta al último instalador.

## Probar en tu compu (opcional)
`npm install` y después `npm start`.
