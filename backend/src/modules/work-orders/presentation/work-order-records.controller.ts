/**
 * Objetivo: endpoints de registros asociados a una orden:
 * registro técnico interno, adjuntos y notificaciones (botones manuales).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { CurrentUser, Roles } from '../../../common/decorators/auth.decorators';
import { parseJsonDto } from '../../../common/pipes/parse-json-body.pipe';
import { NotificationResponseDto } from '../../notifications/application/notification.dto';
import { UserRole } from '../../users/domain/user-role.enum';
import { AttachmentsService } from '../application/attachments.service';
import { CreateTechnicalLogDto, UploadAttachmentDto } from '../application/dto/work-order-input.dto';
import type { AttachmentDto, TechnicalLogDto } from '../application/dto/work-order-output.dto';
import { TechnicalLogsService } from '../application/technical-logs.service';
import { WorkOrderNotificationsService } from '../application/work-order-notifications.service';
import { contentDisposition } from './content-disposition';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders/:id')
export class WorkOrderRecordsController {
  constructor(
    private readonly technicalLogs: TechnicalLogsService,
    private readonly attachments: AttachmentsService,
    private readonly notifications: WorkOrderNotificationsService,
  ) {}

  @Post('technical-logs')
  @Roles(UserRole.TECNICO, UserRole.RECEPCIONISTA)
  @UseInterceptors(FilesInterceptor('documents'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Agregar registro técnico INTERNO (no visible para el cliente)' })
  async addTechnicalLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('data') data: string,
    @UploadedFiles() documents: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<TechnicalLogDto> {
    const dto = await parseJsonDto(CreateTechnicalLogDto, data);
    return this.technicalLogs.create(id, dto, documents, user);
  }

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Adjuntar foto o documento a la orden' })
  uploadAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<AttachmentDto> {
    return this.attachments.upload(id, dto, file, user);
  }

  @Get('attachments/:attachmentId/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachments.open(id, attachmentId);
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      length: attachment.sizeBytes,
      disposition: contentDisposition(attachment.originalName, attachment.mimeType),
    });
  }

  @Get('notifications')
  listNotifications(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationResponseDto[]> {
    return this.notifications.list(id);
  }

  @Post('notifications/quotation')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Botón: enviar cotización al cliente por correo' })
  sendQuotation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationResponseDto> {
    return this.notifications.sendQuotation(id, user);
  }

  @Post('notifications/ready-for-pickup')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Botón: notificar al cliente que el equipo está listo para retirar' })
  sendReadyForPickup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationResponseDto> {
    return this.notifications.sendReadyForPickup(id, user);
  }
}
