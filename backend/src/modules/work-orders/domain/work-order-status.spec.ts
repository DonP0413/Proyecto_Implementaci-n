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

  it('ENTREGADO es estado terminal', () => {
    expect(WorkOrderStateMachine.allowedTransitions(S.ENTREGADO)).toEqual([]);
  });

  it('las transiciones manuales excluyen cotización y entrega', () => {
    expect(WorkOrderStateMachine.manualTransitions(S.EN_REVISION)).toEqual([
      S.EN_REPARACION,
      S.LISTO_PARA_RETIRAR,
    ]);
    expect(WorkOrderStateMachine.manualTransitions(S.LISTO_PARA_RETIRAR)).toEqual([S.EN_REPARACION]);
  });
});
