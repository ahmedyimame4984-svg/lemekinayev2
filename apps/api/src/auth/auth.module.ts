import { Module } from '@nestjs/common';
import { EmailModule } from '../common/email/email.module.js';
import { SellerAccountRegistrationService } from './seller-account-registration.service.js';
import { SellerAccountRegistrationController } from './seller-account-registration.controller.js';
import { APP_GUARD } from '@nestjs/core';
import { AdminAccessController } from './admin-access.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthCrypto } from './admin-auth.crypto.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminProvisioningController } from './admin-provisioning.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { SessionService } from './session.service.js';
import { SellerAuthController } from './seller-auth.controller.js';
import { SellerAuthService } from './seller-auth.service.js';

@Module({
  imports: [EmailModule],
  controllers: [
    SellerAccountRegistrationController,
    AuthController,
    AdminAccessController,
    AdminAuthController,
    AdminProvisioningController,
    SellerAuthController,
  ],
  providers: [
    SellerAccountRegistrationService,
    SessionService,
    AdminAuthCrypto,
    AuthThrottleService,
    AdminAuthService,
    SellerAuthService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [SessionService, AdminAuthService, SellerAuthService, AuthThrottleService],
})
export class AuthModule {}
