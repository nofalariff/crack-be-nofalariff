import { UserRole } from '@prisma/client';

// Bentuk payload JWT setelah divalidasi JwtStrategy — planbackend.md §6.4.
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
