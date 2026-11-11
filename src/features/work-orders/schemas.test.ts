import { clientSchema, deliverySchema, newWorkOrderSchema, toCreateWorkOrderRequest, type NewWorkOrderFormValues } from './schemas';

const base: NewWorkOrderFormValues = {
  receivedAt: '2026-11-08T09:30',
  clientMode: 'new',
  client: { fullName: 'María Pérez', email: 'maria@example.com', documentId: '', phone: '', address: '' },
  equipment: { equipmentTypeId: 1, brand: 'HP', model: 'Pavilion', serialNumber: ' SN1 ', technicalSpecs: { ram: '16 GB', storage: '' } },
  extraSpecs: [],
  reportedIssue: 'No enciende',
  reception: { powerStatus: 'NO', physicalCondition: 'BUENO', visibleDamage: '', functionalNotes: '' },
  accessories: [{ name: 'Cargador', quantity: 1, notes: '' }],
  assignedTechnicianId: '',
  estimatedDeliveryDate: '',
};

describe('newWorkOrderSchema', () => {
  it('acepta un formulario válido con cliente nuevo', () => {
    expect(newWorkOrderSchema.safeParse(base).success).toBe(true);
  });

  it('exige correo válido del cliente nuevo', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, client: { ...base.client, email: 'no-correo' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['client', 'email']);
  });

  it('exige seleccionar cliente existente', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, clientMode: 'existing', clientId: '' });
    expect(result.success).toBe(false);
  });

  it('exige tipo de equipo', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, equipment: { ...base.equipment, equipmentTypeId: Number.NaN } });
    expect(result.success).toBe(false);
  });
});

describe('fecha de ingreso', () => {
  it('exige la fecha de ingreso', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, receivedAt: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['receivedAt']);
  });

  it('rechaza una fecha de ingreso futura', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, receivedAt: '2999-01-01T10:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/futura/);
  });

  it('envía la fecha en ISO y el cliente nuevo ingresa el mismo día', () => {
    const request = toCreateWorkOrderRequest(base);
    expect(request.receivedAt).toBe(new Date('2026-11-08T09:30').toISOString());
    expect(request.client?.registeredAt).toBe('2026-11-08');
  });

  it('el cliente rechaza fechas de ingreso futuras', () => {
    expect(clientSchema.safeParse({ fullName: 'Ana Pérez', email: 'ana@example.com', registeredAt: '2999-01-01' }).success).toBe(false);
    expect(clientSchema.safeParse({ fullName: 'Ana Pérez', email: 'ana@example.com', registeredAt: '2026-01-15' }).success).toBe(true);
  });
});

describe('especificaciones adicionales', () => {
  it('se envían con prefijo junto a las características del catálogo', () => {
    const request = toCreateWorkOrderRequest({
      ...base,
      extraSpecs: [
        { name: ' Lector de huella ', value: ' Sí ' },
        { name: '', value: '' },
      ],
    });
    expect(request.equipment.technicalSpecs).toEqual({ ram: '16 GB', '+Lector de huella': 'Sí' });
  });

  it('exige nombre y valor cuando se llena uno de los dos', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, extraSpecs: [{ name: 'Teclado', value: '' }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['extraSpecs', 0, 'value']);
  });
});

describe('toCreateWorkOrderRequest', () => {
  it('limpia campos vacíos y especificaciones sin valor', () => {
    const request = toCreateWorkOrderRequest(base);
    expect(request.client?.documentId).toBeUndefined();
    expect(request.equipment.serialNumber).toBe('SN1');
    expect(request.equipment.technicalSpecs).toEqual({ ram: '16 GB' });
    expect(request.accessories[0].notes).toBeUndefined();
  });

  it('envía clientId cuando el cliente ya existe', () => {
    const request = toCreateWorkOrderRequest({ ...base, clientMode: 'existing', clientId: 'abc' });
    expect(request.clientId).toBe('abc');
    expect(request.client).toBeUndefined();
  });
});

describe('deliverySchema', () => {
  it('rechaza montos negativos', () => {
    const result = deliverySchema.safeParse({
      workSummary: 'Cambio de pantalla',
      amountCharged: -1,
      returnCondition: 'Funcional',
      receivedByName: 'María',
      returnedAccessoryIds: [],
    });
    expect(result.success).toBe(false);
  });
});
