import { payerConcept } from './payer-concept.policy';

describe('payerConcept', () => {
  it('antepone el nombre del negocio, porque el banco solo muestra al titular de la cuenta', () => {
    expect(payerConcept('Tacos Ana', 'Orden 12')).toBe('Tacos Ana: Orden 12');
  });

  it('sin concepto usa solo el nombre del negocio', () => {
    expect(payerConcept('Tacos Ana', null)).toBe('Tacos Ana');
    expect(payerConcept('Tacos Ana', '   ')).toBe('Tacos Ana');
  });

  it('respeta el máximo de 40 caracteres de CoDi sin dejar espacios al final', () => {
    const concept = payerConcept(
      'Tacos Ana',
      'orden grande para la fiesta del sábado',
    );
    expect(concept.length).toBeLessThanOrEqual(40);
    expect(concept).toBe('Tacos Ana: orden grande para la fiesta d');
    expect(payerConcept('Tacos Ana', 'x'.repeat(29) + ' y')).not.toMatch(/\s$/);
  });
});
