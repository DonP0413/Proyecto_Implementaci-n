import { BusinessRuleError } from '../../../common/errors/domain.errors';
import { WorkOrderStateMachine, WorkOrderStatus as S } from './work-order-status';

describe('WorkOrderStateMachine', () => {
  it.each([
    [S.INGRESADO, S.EN_REVISION],
    [S.EN_REVISION, S.COTIZACION_GENERADA],
    [S.COTIZACION_GENERADA, S.EN_REPARACION],
    [S.EN_REPARACION, S.LISTO_PARA_RETIRAR],
    [S.LISTO_PARA_RETIRAR, S.ENTREGADO],
  ])('permite el flujo principal %s -> %s', (from, to) => {
    expect(WorkOrderStateMachine.canTransition(from, to)).toBe(true);
  });

  it.each([
    [S.INGRESADO, S.ENTREGADO],
    [S.INGRESADO, S.EN_REPARACION],
    [S.ENTREGADO, S.EN_REVISION],
    [S.EN_REPARACION, S.COTIZACION_GENERADA],
  ])('rechaza %s -> %s', (from, to) => {
    expect(() => WorkOrderStateMachine.assertTransition(from, to)).toThrow(BusinessRuleError);
  });

  it('indica el siguiente estado permitido al rechazar INGRESADO -> ENTREGADO', () => {
    expect(() => WorkOrderStateMachine.assertTransition(S.INGRESADO, S.ENTREGADO)).toThrow(
      'Siguiente estado permitido: "En revisión"',
    );
  });

  it('ENTREGADO es estado terminal', () => {
    expect(WorkOrderStateMachine.allowedTransitions(S.ENTREGADO)).toEqual([]);
  });

  it('las transiciones manuales excluyen cotización y entrega', () => {
    expect(WorkOrderStateMachine.manualTransitions(S.EN_REVISION)).toEqual([
      S.EN_REPARACION,
      S.LISTO_PARA_RETIRAR,
    ]);
    expect(WorkOrderStateMachine.manualTransitions(S.LISTO_PARA_RETIRAR)).toEqual([
      S.EN_REPARACION,
      S.EN_REVISION,
    ]);
  });
});

describe('Nota obligatoria en caminos alternativos', () => {
  it.each([
    [S.EN_REVISION, S.EN_REPARACION],
    [S.EN_REVISION, S.LISTO_PARA_RETIRAR],
    [S.COTIZACION_GENERADA, S.LISTO_PARA_RETIRAR],
    [S.COTIZACION_GENERADA, S.EN_REVISION],
    [S.EN_REPARACION, S.EN_REVISION],
    [S.LISTO_PARA_RETIRAR, S.EN_REPARACION],
    [S.LISTO_PARA_RETIRAR, S.EN_REVISION],
  ])('%s -> %s exige un motivo', (from, to) => {
    expect(WorkOrderStateMachine.notePrompt(from, to)).toEqual(expect.any(String));
    expect(() => WorkOrderStateMachine.assertNote(from, to, undefined)).toThrow(BusinessRuleError);
    expect(() => WorkOrderStateMachine.assertNote(from, to, '  ok  ')).toThrow('requiere una nota');
    expect(() => WorkOrderStateMachine.assertNote(from, to, 'Equipo en garantía')).not.toThrow();
  });

  it.each([
    [S.INGRESADO, S.EN_REVISION],
    [S.COTIZACION_GENERADA, S.EN_REPARACION],
    [S.EN_REPARACION, S.LISTO_PARA_RETIRAR],
  ])('%s -> %s (camino normal) no exige nota', (from, to) => {
    expect(WorkOrderStateMachine.notePrompt(from, to)).toBeNull();
    expect(() => WorkOrderStateMachine.assertNote(from, to, undefined)).not.toThrow();
  });
});
