/** Objetivo: endpoints de soporte de notificaciones (consultar fallidas, reintentar). */
import {
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
import { NotificationResponseDto } from '../application/notification.dto';
import { NotificationsService } from '../application/notifications.service';
import { NotificationStatus } from '../domain/notification.enums';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.RECEPCIONISTA)
  @ApiQuery({ name: 'status', enum: NotificationStatus, required: false })
  list(
    @Query('status', new ParseEnumPipe(NotificationStatus, { optional: true })) status?: NotificationStatus,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationsService.listByStatus(status ?? NotificationStatus.FAILED);
  }

  @Post(':id/retry')
  @Roles(UserRole.RECEPCIONISTA)
  @HttpCode(HttpStatus.ACCEPTED)
  retry(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationResponseDto> {
    return this.notificationsService.retry(id);
  }
}
