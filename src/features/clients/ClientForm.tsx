/**
 * Objetivo: formulario de alta/edición de clientes, reutilizado en la página
 * de Clientes y en la revisión de la entrega (para corregir el correo o el
 * teléfono antes de enviar la confirmación final).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { clientsApi } from '../../api/endpoints';
import type { Client } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/FormField';
import { getErrorMessage } from '../../lib/errors';
import { emptyToUndefined, toDateInput } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import { clientSchema, type ClientFormValues } from '../work-orders/schemas';

interface Props {
  client: Client | null;
  onDone: () => void;
  /** Se llama con el cliente guardado (p. ej. para refrescar la orden que lo muestra). */
  onSaved?: (client: Client) => void;
}

export function ClientForm({ client, onDone, onSaved }: Props) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: client?.fullName ?? '',
      documentId: client?.documentId ?? '',
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      registeredAt: client?.registeredAt ?? toDateInput(),
    },
  });
  const save = useMutation({
    mutationFn: (values: ClientFormValues) => {
      const data = emptyToUndefined(values) as ClientFormValues & { email: string; fullName: string };
      return client ? clientsApi.update(client.id, data) : clientsApi.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const onSubmit = async (values: ClientFormValues) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(client ? 'Cliente actualizado' : 'Cliente registrado');
      onSaved?.(saved);
      onDone();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Input label="Nombre completo" required placeholder="Ej.: María Fernanda Pérez" error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Cédula / RUC" required inputMode="numeric" maxLength={13} placeholder="Ej.: 1718123456" error={errors.documentId?.message} {...register('documentId')} />
      <Input label="Correo electrónico" type="email" required placeholder="Ej.: maria.perez@gmail.com" error={errors.email?.message} {...register('email')} />
      <Input label="Teléfono" type="tel" placeholder="Ej.: 0991234567" error={errors.phone?.message} {...register('phone')} />
      <Input label="Dirección" placeholder="Ej.: Av. Amazonas N34-12 y Naciones Unidas" error={errors.address?.message} {...register('address')} />
      <Input label="Fecha de ingreso" type="date" required max={toDateInput()} error={errors.registeredAt?.message} {...register('registeredAt')} />
      <div className="form-actions">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
