/** Objetivo: endpoints REST de gestión de usuarios (sólo ADMIN, salvo listado de técnicos). */
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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.interface';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { UserRole } from './domain/user-role.enum';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('technicians')
  @ApiOkResponse({ type: [UserResponseDto] })
  technicians(): Promise<UserResponseDto[]> {
    return this.usersService.listTechnicians();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ type: [UserResponseDto] })
  list(): Promise<UserResponseDto[]> {
    return this.usersService.list();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, actor);
  }

  @Put(':id/password')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto): Promise<void> {
    return this.usersService.resetPassword(id, dto);
  }
}
