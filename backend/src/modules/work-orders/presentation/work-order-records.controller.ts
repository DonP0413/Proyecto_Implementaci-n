/**
 * Objetivo: endpoints de registros asociados a una orden:
 * registro técnico interno y adjuntos.
 */
import {
  Body,
  Controller,
  Get,
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
import { UserRole } from '../../users/domain/user-role.enum';
import { AttachmentsService } from '../application/attachments.service';
import { CreateTechnicalLogDto, UploadAttachmentDto } from '../application/dto/work-order-input.dto';
import type { AttachmentDto, TechnicalLogDto } from '../application/dto/work-order-output.dto';
import { TechnicalLogsService } from '../application/technical-logs.service';
import { contentDisposition } from './content-disposition';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders/:id')
export class WorkOrderRecordsController {
  constructor(
    private readonly technicalLogs: TechnicalLogsService,
    private readonly attachments: AttachmentsService,
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
}
