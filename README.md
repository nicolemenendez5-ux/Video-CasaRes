# Casa RES · "Sellamos tus recuerdos" · motion graphic 15 s

| Entregable | Archivo |
|---|---|
| Reels / TikTok 9:16 (1080×1920, 30 fps, H.264 + AAC) | `out/CasaRES_15s_9x16.mp4` |
| YouTube / pantallas en locales 16:9 (1920×1080) | `out/CasaRES_15s_16x9.mp4` |
| Mezcla de audio sola (48 kHz, −14 LUFS, pico −1 dBTP) | `out/CasaRES_15s_audio.wav` |

Los subtítulos van quemados en el video para que se entienda sin sonido. El logo aparece a los 12,9 s y se mantiene hasta el final (2,1 s).

## Guion visual (120 BPM: cada cambio de escena cae en un golpe)

| Tiempo | Escena | Sonido |
|---|---|---|
| 0–0,55 | Oscuridad total, una brasa sola | rumor grave |
| 0,55 | **Chispa**: estallido de chispas sobre la parrilla | pedernal |
| 0,6–1,8 | Las llamas se encienden de centro a bordes, en cámara lenta | *fwoomp* de encendido + chisporroteo |
| 1,8–2,0 | La carne cae con desenfoque de movimiento… | silbido |
| 2,0 | …**impacto** sobre la brasa: sacudida, chispas, humo, calima | golpe húmedo + chisporroteo de carne + boom |
| 2,1–3,0 | Firma "CASA RES · Maestros de la parrilla" | redoble + subida |
| 3,0–4,0 | Un cuchillo cruza el término perfecto: rápido-lento-rápido, deja una ranura incandescente | cuchillo en el aire + filo |
| 4,0–5,0 | **El corte se abre** y revela *"El arte de los cortes"* | golpe del cuchillo sobre la tabla |
| 5,0–6,0 | Macro: sal en grano en cámara lenta (con profundidad de campo y destellos) + anotaciones "SAL EN GRANO" / "SELLADO A LA BRASA" | granos de sal |
| 6,0–8,0 | El humo de la parrilla viaja y **se convierte en tipografía**: *"ENCENDEMOS el fuego"*, que suelta brasas | soplido + golpe al formarse |
| 8,0–9,25 | Interior real de Casa RES desenfocado, bokeh; dos copas de vino chocan | **choque de copas** |
| 8,4–9,0 | COMPARTE · BRINDA · *celebra* al ritmo | palmas |
| 9,25–10,25 | Barrido rápido por la carta: Desayunos · Picadas · Ensaladas · Vinos y jugos | barridos + kicks entrecortados |
| 10,25–12,0 | Mapa de Ecuador en matriz de puntos: Quito, Manta, Guayaquil y Cuenca se encienden como brasas; contador **+15 locales cerca de ti**; cinta con los centros comerciales | campanas por ciudad + redoble que acelera |
| 12,0–12,9 | Las chispas y el humo giran y **se condensan en el emblema** | succión |
| 12,9 | **El sello**: el emblema cae como hierro de marcar al rojo, onda expansiva, vapor; se enfría hasta los colores del vitral | golpe + metal + siseo |
| 13,0–15,0 | CASA RES · Maestros de la parrilla · *Sellamos tus recuerdos* · "Encuéntranos en tu centro comercial favorito" · @casaresecuador · casares.ec | acorde final |

Voz en off (tiempos en `src/vo_lines.json`): se usa el guion completo **sin** la frase opcional *"y hacemos de cada mesa…"*, que no cabía.

## Paleta y tipografías

- Negro `#0A0706`, carbón `#17110E`, brasa `#E8571B`, ámbar `#F29F2E`, dorado `#D8B46A` / `#F4D9A0`, rojo de marca `#DC2C16`, crema `#FEF9EB`, vino `#3D0A0F`.
  El rojo y el crema se tomaron de las capturas de casares.ec; **hay que reemplazarlos por los HEX oficiales** (están en `COL`, al inicio de `src/main.js`).
- Barlow Condensed (titulares, como en la web), Montserrat (logotipo y subtítulos) y Playfair Display itálica (acentos). Todas con licencia OFL, en `src/assets/fonts`.

## Pendiente antes de publicar

1. **Logo**: el emblema de vitral es una recreación vectorial hecha a partir de la captura de la web (`EP` / `CELLS` en `src/main.js`). Hay que cambiarlo por el archivo oficial (SVG).
2. **Fotos**: se usaron las dos capturas que se adjuntaron (el corte con el hierro y el interior del local). Tienen poca resolución, así que los planos macro salen suaves. Con fotos o video originales en alta resolución, la pieza gana mucho. Solo hay que reemplazar `src/assets/steak.webp` / `interior.webp` y ajustar los encuadres.
3. **Voz**: es una voz sintética (Kokoro, `em_alex`, español), bajada 2 semitonos y ecualizada. Sirve de guía de tiempos; para la versión final conviene grabar a un locutor real sobre `out/CasaRES_15s_audio.wav` (o sobre la pista de música y efectos sin voz que genera `audio/build_audio.py`).
4. Los puntos del mapa son posiciones aproximadas de los locales; no son coordenadas exactas.

## Cómo se construye

Todo es código y es determinista: el video es una función pura del tiempo (`renderFrame(t)` en `src/main.js`, canvas 2D). Chromium (Playwright) lo renderiza cuadro a cuadro y ffmpeg lo codifica. La música y los efectos están sintetizados con numpy/scipy (`audio/build_audio.py`).

```bash
pip install kokoro-onnx soundfile scipy numpy
# modelos de voz: kokoro-v1.0.onnx y voices-v1.0.bin de
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
tools/build.sh /ruta/a/modelos_kokoro
```

Para revisar fotogramas sueltos:
`node tools/render.mjs stills 1080 1920 /tmp/st 2.0,4.3,12.95 src/vo_lines.json`
