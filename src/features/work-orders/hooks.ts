/**
 * Objetivo: hooks de React Query (estado del servidor). Centralizan las
 * query keys, la caché y la invalidación tras cada mutación, de modo que
 * los componentes sólo declaran QUÉ datos necesitan.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, workOrdersApi } from '../../api/endpoints';
import type { WorkOrderDetail, WorkOrderFilters, WorkOrderStatus } from '../../api/types';

export const workOrderKeys = {
  all: ['work-orders'] as const,
  list: (filters: WorkOrderFilters) => ['work-orders', 'list', filters] as const,
  stats: ['work-orders', 'stats'] as const,
  detail: (id: string) => ['work-orders', 'detail', id] as const,
  notifications: (id: string) => ['work-orders', 'notifications', id] as const,
};

export const useWorkOrders = (filters: WorkOrderFilters) =>
  useQuery({ queryKey: workOrderKeys.list(filters), queryFn: () => workOrdersApi.search(filters), placeholderData: keepPreviousData });

export const useWorkOrderStats = () => useQuery({ queryKey: workOrderKeys.stats, queryFn: workOrdersApi.stats });

export const useWorkOrder = (id: string) =>
  useQuery({ queryKey: workOrderKeys.detail(id), queryFn: () => workOrdersApi.detail(id), enabled: !!id });

export const useWorkOrderNotifications = (id: string) =>
  useQuery({
    queryKey: workOrderKeys.notifications(id),
    queryFn: () => workOrdersApi.notifications(id),
    // Mientras haya correos pendientes, refrescar cada 5 s para ver el resultado del envío
    refetchInterval: (query) =>
      query.state.data?.some((n) => n.status === 'PENDING' || n.status === 'SENDING') ? 5000 : false,
  });

export const useEquipmentTypes = () =>
  useQuery({ queryKey: ['equipment-types'], queryFn: catalogApi.equipmentTypes, staleTime: 10 * 60_000 });

export const useTechnicians = () => useQuery({ queryKey: ['technicians'], queryFn: catalogApi.technicians, staleTime: 5 * 60_000 });

/** Tras una mutación que devuelve el detalle actualizado: refresca caché e invalida listados. */
const useDetailUpdater = (id: string) => {
  const queryClient = useQueryClient();
  return (detail?: WorkOrderDetail) => {
    if (detail) queryClient.setQueryData(workOrderKeys.detail(id), detail);
    else void queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: ['work-orders', 'list'] });
    void queryClient.invalidateQueries({ queryKey: workOrderKeys.stats });
    void queryClient.invalidateQueries({ queryKey: workOrderKeys.notifications(id) });
  };
};

export const useCreateWorkOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, photos }: { data: Parameters<typeof workOrdersApi.create>[0]; photos: File[] }) =>
      workOrdersApi.create(data, photos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workOrderKeys.all }),
  });
};

export const useChangeStatus = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({
    mutationFn: ({ status, note }: { status: WorkOrderStatus; note?: string }) => workOrdersApi.changeStatus(id, status, note),
    onSuccess: update,
  });
};

export const useAssignTechnician = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({ mutationFn: (technicianId: string | null) => workOrdersApi.assignTechnician(id, technicianId), onSuccess: update });
};

export const useCreateQuotation = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({
    mutationFn: (data: Parameters<typeof workOrdersApi.createQuotation>[1]) => workOrdersApi.createQuotation(id, data),
    onSuccess: update,
  });
};

export const useRegisterDelivery = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({
    mutationFn: ({ data, photo }: { data: Parameters<typeof workOrdersApi.registerDelivery>[1]; photo?: File }) =>
      workOrdersApi.registerDelivery(id, data, photo),
    onSuccess: update,
  });
};

export const useAddTechnicalLog = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({
    mutationFn: ({ data, documents }: { data: Parameters<typeof workOrdersApi.addTechnicalLog>[1]; documents: File[] }) =>
      workOrdersApi.addTechnicalLog(id, data, documents),
    onSuccess: () => update(),
  });
};

export const useUploadAttachment = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({
    mutationFn: ({ category, file }: { category: Parameters<typeof workOrdersApi.uploadAttachment>[1]; file: File }) =>
      workOrdersApi.uploadAttachment(id, category, file),
    onSuccess: () => update(),
  });
};

export const useSendQuotation = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({ mutationFn: () => workOrdersApi.sendQuotation(id), onSuccess: () => update() });
};

export const useSendReadyForPickup = (id: string) => {
  const update = useDetailUpdater(id);
  return useMutation({ mutationFn: () => workOrdersApi.sendReadyForPickup(id), onSuccess: () => update() });
};
