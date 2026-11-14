/** Objetivo: endpoints de soporte de notificaciones (consultar fallidas, vista previa y reintentar). */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/auth.decorators';
import { UserRole } from '../../users/domain/user-role.enum';
import {
  NotificationPreviewDto,
  NotificationResponseDto,
  RetryNotificationDto,
} from '../application/notification.dto';
import { NotificationsService } from '../application/notifications.service';
import { NotificationStatus } from '../domain/notification.enums';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  @ApiQuery({ name: 'status', enum: NotificationStatus, required: false })
  list(
    @Query('status', new ParseEnumPipe(NotificationStatus, { optional: true })) status?: NotificationStatus,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationsService.listByStatus(status ?? NotificationStatus.FAILED);
  }

  @Get(':id/preview')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  preview(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationPreviewDto> {
    return this.notificationsService.preview(id);
  }

  @Post(':id/retry')
  @Roles(UserRole.RECEPCIONISTA, UserRole.TECNICO)
  @HttpCode(HttpStatus.ACCEPTED)
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: RetryNotificationDto,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.retry(id, dto?.recipientEmail);
  }
}
