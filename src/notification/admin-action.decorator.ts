import { SetMetadata } from '@nestjs/common';

export const ADMIN_ACTION_KEY = 'adminAction';

export const AdminAction = (action: string) =>
  SetMetadata(ADMIN_ACTION_KEY, action);
