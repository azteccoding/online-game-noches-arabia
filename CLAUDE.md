# Reglas de estilo del proyecto «Mil y una Noches»

- **Nunca escribir «Mahoma»** (ni «Mahomet», «Mahomed» o «Mohamed» referidos al Profeta). Usar «el Profeta Muhammad (la paz sea con él)» en la primera mención de cada texto y «el Profeta» en las siguientes, con la concordancia correcta («del Profeta Muhammad»). Es una cuestión de respeto. La prueba `tests/estilo.test.mjs` (dentro de `npm test`) lo comprueba.
- **Español de México**: el separador de miles es la coma (**1,001 noches**, 12,500 dinares) y el decimal es el punto. Al formatear números en código, usar `toLocaleString('es-MX')`.
- No cambiar las reglas del juego desde el código: la fuente es el reglamento extendido.
- **Commits**: no añadir líneas «Co-Authored-By» ni «Claude-Session» ni mencionar a Claude en los mensajes de commit. El repositorio es de Jorge.
