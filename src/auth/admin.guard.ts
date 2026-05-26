import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Account } from 'src/account/entities/account.entity';
import { IS_ADMIN_KEY } from 'src/common/decorators/admin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly dataSource: DataSource,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isAdminRequired = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!isAdminRequired) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const accountId = request.account?.sub;
        if (!accountId) {
            throw new ForbiddenException('ADMIN_REQUIRED');
        }

        const account = await this.dataSource.getRepository(Account).findOne({
            where: { id: accountId },
        });
        if (!account?.isAdmin) {
            throw new ForbiddenException('ADMIN_REQUIRED');
        }

        return true;
    }
}
