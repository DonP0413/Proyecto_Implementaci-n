/**
 * Objetivo: endpoints REST principales del ciclo de vida de una orden:
 * registro (multipart con fotos), búsqueda, detalle, estados, técnico,
 * cotización, entrega (multipart con foto) y los 3 documentos PDF.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../../common/auth/auth-user.interface';
import { CurrentUser, Roles } from '../../../common/decorators/auth.decorators';
import type { Paginated } from '../../../common/pagination/pagination';
import { parseJsonDto } from '../../../common/pipes/parse-json-body.pipe';
import { UserRole } from '../../users/domain/user-role.enum';
import {
  AssignTechnicianDto,
  ChangeStatusDto,
  CreateQuotationDto,
  CreateWorkOrderDto,
  RegisterDeliveryDto,
  UpdateWorkOrderIntakeDto,
  WorkOrderQueryDto,
} from '../application/dto/work-order-input.dto';
import type {
  WorkOrderCreatedDto,
  WorkOrderDetailDto,
  WorkOrderSummaryDto,
} from '../application/dto/work-order-output.dto';
import { PdfFile, ReceiptService } from '../application/receipt.service';
import { WorkOrderCommandService } from '../application/work-order-command.service';
import { WorkOrderQueryService } from '../application/work-order-query.service';
import { contentDisposition } from './content-disposition';

const multipartSchema = (fileField: string, multiple: boolean, description: string) => ({
  schema: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'string', description },
      [fileField]: multiple
        ? { type: 'array', items: { type: 'string', format: 'binary' } }
        : { type: 'string', format: 'binary' },
    },
  },
});

const pdfResponse = ({ filename, stream }: PdfFile): StreamableFile =>
  new StreamableFile(stream, {
    type: 'application/pdf',
    disposition: contentDisposition(filename, 'application/pdf'),
  });

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly commands: WorkOrderCommandService,
    private readonly queries: WorkOrderQueryService,
    private readonly receipts: ReceiptService,
  ) {}

  @Post()
  @Roles(UserRole.RECEPCIONISTA)
  @UseInterceptors(FilesInterceptor('photos'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartSchema('photos', true, 'JSON de CreateWorkOrderDto'))
  @ApiOperation({ summary: 'Registrar ingreso de equipo (genera el comprobante PDF de ingreso)' })
  async create(
    @Body('data') data: string,
    @UploadedFiles() photos: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderCreatedDto> {
    const dto = await parseJsonDto(CreateWorkOrderDto, data);
    return this.commands.create(dto, photos, user);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar órdenes por ID de trabajo, cliente, serie, fecha o estado' })
  search(@Query() query: WorkOrderQueryDto): Promise<Paginated<WorkOrderSummaryDto>> {
    return this.queries.search(query);
  }

  @Get('stats')
  stats() {
    return this.queries.stats();
  }

  @Get('by-code/:code')
  findByCode(@Param('code') code: string) {
    return this.queries.findIdByCode(code);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderDetailDto> {
    return this.queries.detail(id);
  }

  @Patch(':id/intake')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  @ApiOperation({
    summary:
      'Corregir datos del ingreso mientras la orden está en estado "Ingresado" (registra quién corrigió y cuándo)',
  })
  async updateIntake(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderIntakeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDetailDto> {
    await this.commands.updateIntake(id, dto, user);
    return this.queries.detail(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.TECNICO, UserRole.RECEPCIONISTA)
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDetailDto> {
    await this.commands.changeStatus(id, dto, user);
    return this.queries.detail(id);
  }

  @Patch(':id/technician')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  async assignTechnician(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDetailDto> {
    await this.commands.assignTechnician(id, dto, user);
    return this.queries.detail(id);
  }

  @Post(':id/quotations')
  @Roles(UserRole.TECNICO, UserRole.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Registrar cotización (pasa a "Cotización generada"; su PDF se descarga con su botón)',
  })
  async createQuotation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDetailDto> {
    await this.commands.createQuotation(id, dto, user);
    return this.queries.detail(id);
  }

  @Post(':id/delivery')
  @Roles(UserRole.RECEPCIONISTA)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartSchema('photo', false, 'JSON de RegisterDeliveryDto'))
  @ApiOperation({ summary: 'Registrar entrega' })
  async registerDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('data') data: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkOrderDetailDto> {
    const dto = await parseJsonDto(RegisterDeliveryDto, data);
    await this.commands.registerDelivery(id, dto, photo, user);
    return this.queries.detail(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'PDF 1: comprobante de ingreso del equipo (con políticas de garantía)' })
  async receipt(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return pdfResponse(await this.receipts.getReceipt(id));
  }

  @Get(':id/quotation-pdf')
  @ApiOperation({ summary: 'PDF 2: cotización vigente (con políticas de garantía)' })
  async quotationPdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return pdfResponse(await this.receipts.getQuotationPdf(id));
  }

  @Get(':id/ready-pdf')
  @ApiOperation({
    summary: 'PDF 3: equipo listo para entregar / comprobante de entrega (con políticas de garantía)',
  })
  async readyPdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return pdfResponse(await this.receipts.getReadyForPickupPdf(id));
  }
}
