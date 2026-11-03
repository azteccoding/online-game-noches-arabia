# Cambios de reglas pendientes de pasar a los documentos

Cambios hechos en el juego en línea desde el último ajuste de documentos (transportes, 2 de noviembre de 2026).
Jorge pidió **no tocar todavía** los Word, PDF ni cartas: se actualizarán todos juntos más adelante.
Al hacerlo: respaldo primero (carpeta `respaldo-antes-de-…` junto a `documentos/`), luego reglamento extendido, guía, diseño (22.D), hoja resumen e impresión.

| # | Cambio | Commit | Documentos y secciones afectadas | Cartas afectadas |
|---|--------|--------|----------------------------------|------------------|
| 1 | **Asesinos**: solo se contratan con los dinares completos (sin noches ni deuda); al firmar termina el turno, quien los contrata queda Buscado 2 rondas (recompensa 20 noches) y todos saben a quién mandó matar. La subasta de E1 es solo en dinares y su ganador es público. | c70be9f | Reglamento R 12.3 (opción 4) y R 13 (E1); diseño 22.D; hoja resumen (Asesinos) | E1 si menciona noches o anonimato |
| 2 | **Pagos voluntarios** (H2 quedarse, H19 pagar, apedreo, R17) exigen los dinares completos; sin ellos no se ofrece la opción. | c70be9f / aeaeae9 | Reglamento 8.3; cartas H2, H19; R17 | H2, H19, R17 (si dicen «o noches») |
| 3 | **Deudas con el banco**: un pago obligatorio sin dinares deja el saldo en negativo (máximo −50; quien ya debe no suma más deuda). Se cobra solo con lo próximo que entre; mientras debas no puedes comprar. Ya no se paga con noches (se elimina «5 noches = 1 dinar» para pagos forzados). Robos, duelos y Asesinos nunca cobran deuda; las deudas no se heredan al morir. | aeaeae9, 371cf0b | Reglamento 2.2 y 8.3 («pago imposible»); diseño 22.D; hoja resumen («Pagos forzados sin dinares») | — |
| 4 | **Orden de turno**: Yafar (jugador o NPC) juega siempre el último de cada ronda; Adí justo antes (antes Adí era el último y Yafar NPC iba antes que él). | 97174ec | Reglamento R 4.4 y R 20.4/21 (Yafar NPC); guía; ficha de Adí | Carta de personaje de Adí («siempre último») |
| 5 | **Especias de H17**: se venden en Bagdad por 30 dinares sin impuesto (antes no se podían vender). Cada carta en el juego indica dónde se vende y a cuánto. | 97174ec | Reglamento R 13 (H17) | H17 si no lo dice |
| 6 | **Entrenar** (R18 Isfahán, R19 Yemen, R25 Estambul): solo si aún no tienes destreza; la destreza es sí o no. | e0da780 | Reglamento R 11.1 y retos R18/R19/R25 | R18, R19, R25 (requisito) |
| 7 | **Reacciones rápidas** entre jugadores (solo en línea; no es regla de mesa). | 3bd9755 | Guía de juego en línea (opcional) | — |
| 8 | **Peleas**: ninguna tirada es automática; cada bando lanza sus propios dados (atacante, defensor, arco, escudo); los NPC lanzan solos a la vista; el banco lanza por un jugador desconectado. El desglose (dados, armas, ventaja, total) se muestra paso a paso. Los ghul: cada jugador lanza su dado. | c2ff4f8 | Guía (cómo se ven las peleas); reglamento R 11 si describe quién tira | — |

## Pendientes en cola (se anotarán al hacerse)
- Noches al llegar a Andalucía y Samarcanda (más altas).
- Tratos que combinan dinares + noches + objetos.
- Tarifas de viaje a Magreb, Samarcanda e India; retos y premios de India.
- Alojamiento: más caro en Andalucía, Estambul y Yemen; más barato en Bagdad, Basra y Aleppo.
- Asesinato más difícil (esperando la decisión de Jorge).
