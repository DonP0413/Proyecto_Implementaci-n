/** Objetivo: endpoints REST de clientes. */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import type { Paginated } from '../../common/pagination/pagination';
import { UserRole } from '../users/domain/user-role.enum';
import { ClientsService } from './clients.service';
import { ClientQueryDto, ClientResponseDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  search(@Query() query: ClientQueryDto): Promise<Paginated<ClientResponseDto>> {
    return this.clientsService.search(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ClientResponseDto> {
    return this.clientsService.get(id);
  }

  @Post()
  @Roles(UserRole.RECEPCIONISTA)
  create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.RECEPCIONISTA)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.update(id, dto);
  }
}
