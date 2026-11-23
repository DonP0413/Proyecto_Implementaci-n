import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkOrderDetail } from '../../../api/types';
import { useAuthStore } from '../../../stores/authStore';
import { DeliverySection } from './DeliverySection';

const mutateAsync = vi.fn().mockResolvedValue({});
vi.mock('../hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks')>()),
  useRegisterDelivery: () => ({ mutateAsync, isPending: false }),
}));

const wo = {
  id: 'wo1',
  code: 'PT-2026-000010',
  client: { id: 'c1', fullName: 'Ana Pérez', email: 'ana@example.com', phone: '0991234567', documentId: '1718123456' },
  actions: { canRegisterDelivery: true, canDownloadReadyPdf: true },
  clientVisible: {
    delivery: null,
    quotations: [{ id: 'q1', amount: 50 }],
    accessories: [
      { id: 'a1', name: 'Cargador', quantity: 1 },
      { id: 'a2', name: 'Funda', quantity: 1 },
    ],
    attachments: [],
  },
} as unknown as WorkOrderDetail;

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeliverySection wo={wo} />
    </QueryClientProvider>,
  );

const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/Descripción del trabajo realizado/), { target: { value: 'Cambio de pantalla' } });
  fireEvent.change(screen.getByLabelText(/Condiciones en que se devuelve/), { target: { value: 'Funcional y limpio' } });
  fireEvent.change(screen.getByLabelText(/Valor cobrado/), { target: { value: '60' } });
  fireEvent.click(screen.getByLabelText(/Funda/)); // desmarca un accesorio
};

describe('DeliverySection — editar, revisar y confirmar', () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    window.scrollTo = vi.fn() as never; // jsdom no implementa scrollTo
    useAuthStore.setState({ hasRole: () => true } as never);
  });

  it('muestra un resumen con avisos y no registra hasta confirmar "¿Está seguro?"', async () => {
    renderSection();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Revisar entrega/ }));

    expect(await screen.findByText('Revise la entrega antes de finalizar')).toBeInTheDocument();
    expect(screen.getByText('Cambio de pantalla')).toBeInTheDocument();
    expect(screen.getByText(/Funda ×1 — NO se devuelve/)).toBeInTheDocument();
    expect(screen.getByText(/distinto a la cotización vigente/)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar entrega' }));
    expect(screen.getByText('¿Está seguro de finalizar la entrega?')).toBeInTheDocument();
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sí, finalizar entrega/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0].data).toMatchObject({ workSummary: 'Cambio de pantalla', amountCharged: 60, returnedAccessoryIds: ['a1'] });
  });

  it('permite volver a editar conservando lo escrito', async () => {
    renderSection();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Revisar entrega/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Editar datos de la entrega/ }));

    expect(screen.getByLabelText(/Descripción del trabajo realizado/)).toHaveValue('Cambio de pantalla');
    expect(screen.getByLabelText(/Valor cobrado/)).toHaveValue('60');
    expect(screen.getByLabelText(/Funda/)).not.toBeChecked();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('rechaza valores negativos o con letras en Valor cobrado y pide un valor válido (CA-032)', async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText(/Descripción del trabajo realizado/), { target: { value: 'Cambio de pantalla' } });
    fireEvent.change(screen.getByLabelText(/Condiciones en que se devuelve/), { target: { value: 'Funcional y limpio' } });

    fireEvent.change(screen.getByLabelText(/Valor cobrado/), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar entrega/ }));
    expect(await screen.findByText(/valor válido/i)).toBeInTheDocument();
    expect(screen.queryByText('Revise la entrega antes de finalizar')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Valor cobrado/), { target: { value: '-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar entrega/ }));
    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('cancelar el "¿Está seguro?" no registra la entrega', async () => {
    renderSection();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /Revisar entrega/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar entrega' }));
    fireEvent.click(screen.getByRole('button', { name: /No, volver a revisar/ }));

    expect(screen.queryByText('¿Está seguro de finalizar la entrega?')).not.toBeInTheDocument();
    expect(screen.getByText('Revise la entrega antes de finalizar')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
