# Contenido estático de ubicaba.com

Todo lo que está en esta carpeta se convierte en páginas HTML estáticas (legibles por Google sin ejecutar el juego) con `scripts/build-content.mjs`. El script corre solo antes de `npm run dev` y de `npm run build`; para regenerar a mano: `npm run content`.

| Carpeta | URL | Formato |
| --- | --- | --- |
| `paginas/*.html` | `/<archivo>` | HTML con front matter (`titulo`, `descripcion`, `anuncios`) |
| `guias/*.md` | `/guias/<archivo>` | Markdown con front matter (`titulo`, `descripcion`, `orden`, `actualizado`) |
| `barrios/*.md` | `/barrios/<archivo>` | Markdown con front matter (`nombre`, `descripcion`, `actualizado`) |

Los HTML generados van a `public/` y están en `.gitignore`: se editan acá, nunca en `public/`.

## Agregar una guía

1. Creá `content/guias/mi-guia.md`:

   ```md
   ---
   titulo: Título de la guía
   descripcion: Una o dos oraciones; se usa como meta description.
   orden: 6
   actualizado: 1 de noviembre de 2026
   ---
   Texto en Markdown, con ## subtítulos.
   ```

2. Corré `npm run content` y abrí `http://localhost:5173/guias/mi-guia`.

La guía aparece sola en `/guias`, en el sitemap y en "Seguí leyendo" de las demás guías. Si querés que aparezca en el inicio del juego, agregala en `src/Dashboard.jsx`.

## Barrios

Hay un archivo por barrio y el nombre del archivo tiene que ser el nombre del barrio sin tildes (`nunez.md` para Núñez). El build falla si falta alguno de los barrios de la base o si un archivo no coincide con ninguno.

El bloque "En UbiCABA" (cantidad de esquinas, calles más frecuentes, precisión de los jugadores y ranking de dificultad) se calcula en cada build con los datos de Supabase. Si Supabase no responde, usa `src/data/*.json` y omite la precisión.

### Fotos

Las fotos son de Wikimedia Commons, con licencia libre, y se enlazan directo (no se sube nada). `content/imagenes-barrios.json` guarda la URL y el crédito de cada una. Para buscarlas de nuevo:

```
node scripts/fetch-barrio-images.mjs
```

Para elegir una foto a mano, editá su entrada en el JSON con los datos de la página de Commons y agregá `"fijada": true` para que el script no la reemplace.

## Validaciones del build

El build falla (y no se despliega nada) si:

- hay un link interno roto (`/algo` que no es una página generada, una ruta del juego o un archivo de `public/`);
- falta un campo obligatorio del front matter;
- falta la guía de algún barrio o sobra un archivo que no coincide con ningún barrio.

Además avisa (sin fallar) cuando una página tiene menos de 250 palabras.

## Anuncios

Las páginas de contenido llevan un bloque de AdSense al final, salvo las que tienen `anuncios: false` (términos y privacidad). En el juego, el único bloque está en `/ranking`. No pongas anuncios en pantallas sin contenido propio (el juego, cargas, login, resultados individuales): es lo que AdSense marca como "anuncios en pantallas sin contenido del editor".
