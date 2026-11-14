import {
  clientSchema,
  deliverySchema,
  newWorkOrderSchema,
  parseAmountInput,
  quotationSchema,
  toCreateWorkOrderRequest,
  toUpdateIntakeRequest,
  updateIntakeSchema,
  type NewWorkOrderFormValues,
  type UpdateIntakeFormValues,
} from './schemas';

const base: NewWorkOrderFormValues = {
  receivedAt: '2026-11-08T09:30',
  clientMode: 'new',
  client: { fullName: 'María Pérez', email: 'maria@example.com', documentId: '1718123456', phone: '', address: '' },
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

  it('exige cédula / RUC del cliente nuevo', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, client: { ...base.client, documentId: '' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['client', 'documentId']);
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

  it('exige número de serie del equipo', () => {
    const result = newWorkOrderSchema.safeParse({ ...base, equipment: { ...base.equipment, serialNumber: '   ' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['equipment', 'serialNumber']);
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
    expect(clientSchema.safeParse({ fullName: 'Ana Pérez', documentId: '1718123456', email: 'ana@example.com', registeredAt: '2999-01-01' }).success).toBe(false);
    expect(clientSchema.safeParse({ fullName: 'Ana Pérez', documentId: '1718123456', email: 'ana@example.com', registeredAt: '2026-01-15' }).success).toBe(true);
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
    expect(request.client?.documentId).toBe('1718123456');
    expect(request.equipment.serialNumber).toBe('SN1');
    expect(request.equipment.forceNewEquipment).toBeUndefined();
    expect(request.equipment.technicalSpecs).toEqual({ ram: '16 GB' });
    expect(request.accessories[0].notes).toBeUndefined();
  });

  it('incluye forceNewEquipment cuando se marca equipo distinto con serie repetida', () => {
    const request = toCreateWorkOrderRequest({
      ...base,
      equipment: { ...base.equipment, forceNewEquipment: true },
    });
    expect(request.equipment.forceNewEquipment).toBe(true);
  });

  it('envía clientId cuando el cliente ya existe', () => {
    const request = toCreateWorkOrderRequest({ ...base, clientMode: 'existing', clientId: 'abc' });
    expect(request.clientId).toBe('abc');
    expect(request.client).toBeUndefined();
  });
});

describe('updateIntakeSchema y toUpdateIntakeRequest', () => {
  const intakeBase: UpdateIntakeFormValues = {
    client: { fullName: 'María Pérez', documentId: '1718123456', email: 'maria@example.com', phone: '', address: '' },
    equipment: { equipmentTypeId: 1, brand: 'HP', model: 'Pavilion', serialNumber: 'SN-2', technicalSpecs: { ram: '16 GB' } },
    extraSpecs: [{ name: 'Color', value: 'Negro' }],
    reportedIssue: 'No enciende',
    reception: { powerStatus: 'NO', physicalCondition: 'BUENO', visibleDamage: '', functionalNotes: '' },
    estimatedDeliveryDate: '',
  };

  it('valida la corrección de ingreso y normaliza campos vacíos', () => {
    expect(updateIntakeSchema.safeParse(intakeBase).success).toBe(true);
    const req = toUpdateIntakeRequest(intakeBase);
    expect(req.client.phone).toBeNull();
    expect(req.client.address).toBeNull();
    expect(req.estimatedDeliveryDate).toBeNull();
    expect(req.equipment.technicalSpecs).toEqual({ ram: '16 GB', '+Color': 'Negro' });
  });
});

describe('deliverySchema y quotationSchema (CA-032)', () => {
  it('rechaza montos negativos', () => {
    const result = deliverySchema.safeParse({
      workSummary: 'Cambio de pantalla',
      amountCharged: parseAmountInput('-10'),
      returnCondition: 'Funcional',
      receivedByName: 'María',
      returnedAccessoryIds: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/negativo|válido/i);
  });

  it('rechaza montos con letras en entrega y cotización', () => {
    const deliveryResult = deliverySchema.safeParse({
      workSummary: 'Cambio de pantalla',
      amountCharged: parseAmountInput('abc'),
      returnCondition: 'Funcional',
      receivedByName: 'María',
      returnedAccessoryIds: [],
    });
    expect(deliveryResult.success).toBe(false);
    if (!deliveryResult.success) expect(deliveryResult.error.issues[0].message).toMatch(/válido/i);

    const quoteResult = quotationSchema.safeParse({
      amount: parseAmountInput('45usd'),
      description: 'Cambio de repuesto',
    });
    expect(quoteResult.success).toBe(false);
    if (!quoteResult.success) expect(quoteResult.error.issues[0].message).toMatch(/válido/i);
  });

  it('acepta montos numéricos válidos con decimal o coma', () => {
    const result = deliverySchema.safeParse({
      workSummary: 'Cambio de pantalla',
      amountCharged: parseAmountInput('45,50'),
      returnCondition: 'Funcional',
      receivedByName: 'María',
      returnedAccessoryIds: [],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amountCharged).toBe(45.5);
  });
});
