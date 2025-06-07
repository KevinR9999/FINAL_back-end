function procesarFormulario(values, domElements) {
    const { nombre, edad, fecha, documento, diagnostico, tratamiento, indicaciones } = values;
  
    domElements.pNombre.textContent = nombre;
    domElements.pEdad.textContent = edad;
    domElements.pFecha.textContent = fecha;
    domElements.pDocumento.textContent = documento;
    domElements.pDiagnostico.textContent = diagnostico;
    domElements.pTratamiento.textContent = tratamiento;
    domElements.pIndicaciones.textContent = indicaciones;
  
    const qrText = `Paciente: ${nombre}\nEdad: ${edad}\nFecha: ${fecha}\nDocumento: ${documento}\nDiagnóstico: ${diagnostico}\nTratamiento: ${tratamiento}\nIndicaciones: ${indicaciones}`;
    return qrText;
  }
  
  module.exports = { procesarFormulario };
  