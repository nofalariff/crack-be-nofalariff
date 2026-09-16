import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  // Rate limit (planbackend.md §8.3) tidak relevan untuk E2E test yang
  // memanggil endpoint yang sama berkali-kali dalam hitungan detik.
  canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return Promise.resolve(true);
    return super.canActivate(context);
  }
}
