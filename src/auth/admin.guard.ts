import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { IS_ADMIN_KEY } from 'src/common/decorators/admin.decorator';
import { AdminUser } from 'src/admin-auth/entities/admin-user.entity';

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
        const adminId = request.account?.sub;
        if (!adminId || request.account?.type !== 'admin') {
            throw new ForbiddenException('ADMIN_REQUIRED');
        }

        const admin = await this.dataSource.getRepository(AdminUser).findOne({
            where: { id: adminId },
        });
        if (!admin?.enabled) {
            throw new ForbiddenException('ADMIN_REQUIRED');
        }

        return true;
    }
}
