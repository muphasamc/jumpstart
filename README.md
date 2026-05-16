# jumpstart randomizer

Randomizador de packs de Magic: The Gathering Jumpstart 2020 (set JMP). Tira dos packs aleatorios de temas distintos, arma un mazo de 40 cartas y exporta la lista en formato Moxfield para importar a Tabletop Simulator.

## uso

Abrir `jumpstart_randomizer.html` en un browser moderno. No hay build step ni instalación.

Para desarrollo local:

```bash
python -m http.server 8765
```

## stack

HTML/CSS/JS vanilla en un único archivo. Sin dependencias salvo dos hojas de estilo via CDN.

- [Scryfall](https://scryfall.com) — set data, collector numbers, imágenes de cartas (hover preview)
- [mana-font](https://github.com/andrewgioia/mana) — iconos de maná
