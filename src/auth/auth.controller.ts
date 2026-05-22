import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentAccount, type JwtAccount } from 'src/common/decorators/current-account.decorator';
import { AddressParamDto } from './dto/address-param.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(
            loginDto.address, 
            loginDto.signature
        );
    }

    @Public()
    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(
            registerDto.address,
            registerDto.refCode, 
            registerDto.signature
        );
    }

    @Public()
    @Get('account/:address/exists')
    accountExists(@Param() params: AddressParamDto) {
        return this.authService.accountExists(params.address);
    }

    @Get('profile')
    getProfile(@CurrentAccount() account: JwtAccount) {
        return this.authService.getProfile(
            account.address
        );
    }
}
