import React from 'react';

export default function AcercaDe({ onCerrar }) {
  return (
    <div className="hoja-modal panel" role="dialog" aria-label="Acerca de">
      <div className="desp-cab"><h2>Acerca de</h2><button className="btn mini" onClick={onCerrar}>Cerrar</button></div>
      <div className="desp-cuerpo acerca">
        <h3>Mil y una Noches</h3>
        <p className="ar" style={{ fontSize: 26 }}>ألف ليلة وليلة</p>
        <p>Diseño y redacción: Jorge Montes Carrillo.</p>
        <p>Publicado por la Biblioteca Ibn Hazm de México / gracias a Mullah Khalid Montes.</p>
      </div>
    </div>
  );
}
