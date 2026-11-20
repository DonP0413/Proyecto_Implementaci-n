/** Objetivo: endpoints de autenticación. Login con rate limit estricto (5/min por IP). */
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth/auth-user.interface';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { UserResponseDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { DownloadTokenDto, DownloadTokenResponseDto, LoginDto, LoginResponseDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('download-token')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DownloadTokenResponseDto })
  downloadToken(
    @Body() dto: DownloadTokenDto,
    @CurrentUser() user: AuthUser,
  ): Promise<DownloadTokenResponseDto> {
    return this.authService.createDownloadToken(user, dto.path);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.usersService.getEntity(user.id));
  }
}
