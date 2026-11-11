/** Objetivo: punto único de exportación de entidades del agregado WorkOrder. */
export * from './attachment.entity';
export * from './delivery-record.entity';
export * from './quotation.entity';
export * from './reception-condition.entity';
export * from './status-history.entity';
export * from './technical-log.entity';
export * from './work-order-accessory.entity';
export * from './work-order.entity';

import { AttachmentEntity } from './attachment.entity';
import { DeliveryRecordEntity } from './delivery-record.entity';
import { QuotationEntity } from './quotation.entity';
import { ReceptionConditionEntity } from './reception-condition.entity';
import { StatusHistoryEntity } from './status-history.entity';
import { TechnicalLogEntity } from './technical-log.entity';
import { WorkOrderAccessoryEntity } from './work-order-accessory.entity';
import { WorkOrderEntity } from './work-order.entity';

export const WORK_ORDER_ENTITIES = [
  WorkOrderEntity,
  ReceptionConditionEntity,
  WorkOrderAccessoryEntity,
  QuotationEntity,
  TechnicalLogEntity,
  DeliveryRecordEntity,
  AttachmentEntity,
  StatusHistoryEntity,
];
