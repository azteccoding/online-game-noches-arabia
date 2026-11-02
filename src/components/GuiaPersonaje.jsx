import React from 'react';

// Guía privada del personaje propio (fortalezas, debilidades y consejos). El servidor solo la manda a quien lo lleva.
export default function GuiaPersonaje({ g }) {
  return (
    <div className="guia-pj">
      <h4>Tu guía · {g.resumen}</h4>
      <b>Lo que mejor se te da</b>
      <ul>{g.fuerte.map((x) => <li key={x}>{x}</li>)}</ul>
      <b>Tus puntos débiles</b>
      <ul>{g.debil.map((x) => <li key={x}>{x}</li>)}</ul>
      <b>Consejos</b>
      <ul>{g.consejos.map((x) => <li key={x}>{x}</li>)}</ul>
      <small className="it">Solo tú ves esta guía.</small>
    </div>
  );
}
