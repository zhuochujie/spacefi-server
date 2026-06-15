import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountService } from 'src/account/account.service';
import { NonceService } from 'src/nonce/nonce.service';
import {
  buildLoginMessage,
  buildRegisterMessage,
} from 'src/web3/account-message.util';
import { Web3Service } from 'src/web3/web3.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name, { timestamp: true });
  constructor(
    private readonly accountService: AccountService,
    private readonly jwtService: JwtService,
    private readonly nonceService: NonceService,
    private readonly web3Service: Web3Service,
  ) {}

  async login(
    address: string,
    signature: string,
  ): Promise<{ access_token: string }> {
    const account = await this.accountService.findOne(address);
    if (!account) {
      this.logger.log('账户不存在');
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    // 验证签名
    const nonce = await this.nonceService.getNonce(address);
    await this.nonceService.deleteNonce(address);
    if (!nonce) {
      this.logger.log('Nonce不存在');
      throw new UnauthorizedException('NONCE_NOT_FOUND');
    }

    const message = buildLoginMessage(address, nonce);

    const res = await this.web3Service.accountVerify(
      address,
      message,
      signature,
    );
    if (!res) {
      this.logger.log('签名错误');
      throw new UnauthorizedException('INVALID_SIGNATURE');
    }

    const payload = { sub: account.id, address: account.address };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(address: string, refCode: string, signature: string) {
    const nonce = await this.nonceService.getNonce(address);
    await this.nonceService.deleteNonce(address);
    if (!nonce) {
      this.logger.log('Nonce不存在');
      throw new NotFoundException('NONCE_NOT_FOUND');
    }

    const message = buildRegisterMessage(address, nonce, refCode);

    const res = await this.web3Service.accountVerify(
      address,
      message,
      signature,
    );
    if (!res) {
      this.logger.log('签名错误');
      throw new UnauthorizedException('INVALID_SIGNATURE');
    }

    const account = await this.accountService.createAccount(address, refCode);

    const payload = { sub: account.id, address: account.address };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async accountExists(address: string) {
    const account = await this.accountService.findOne(address);
    return {
      exists: !!account,
    };
  }

  async getProfile(address: string) {
    const account = await this.accountService.findOne(address);
    if (!account) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return {
      id: account.id,
      address: account.address,
      refCode: account.refCode,
      vipLevel: Math.max(account.vipLevel, account.manualVipLevel),
      nodeLevel: account.nodeLevel,
      balance: account.balance,
      usdtBalance: account.usdtBalance,
      createdAt: account.createdAt,
    };
  }
}
