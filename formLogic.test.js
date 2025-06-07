const { procesarFormulario } = require('./formLogic');

test('procesarFormulario actualiza DOM y genera texto QR', () => {
  const values = {
    nombre: "Juan Pérez",
    edad: "45",
    fecha: "2025-04-14",
    documento: "123456789",
    diagnostico: "Hipertensión",
    tratamiento: "Medicamentos",
    indicaciones: "Reposo y control"
  };

  const mockElements = {
    pNombre: { textContent: "" },
    pEdad: { textContent: "" },
    pFecha: { textContent: "" },
    pDocumento: { textContent: "" },
    pDiagnostico: { textContent: "" },
    pTratamiento: { textContent: "" },
    pIndicaciones: { textContent: "" }
  };

  const qr = procesarFormulario(values, mockElements);

  expect(mockElements.pNombre.textContent).toBe("Juan Pérez");
  expect(mockElements.pEdad.textContent).toBe("45");
  expect(qr).toContain("Paciente: Juan Pérez");
  expect(qr).toContain("Hipertensión");
});
