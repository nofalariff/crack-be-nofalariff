import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Membatasi endpoint ke role tertentu — dibaca oleh RolesGuard.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
