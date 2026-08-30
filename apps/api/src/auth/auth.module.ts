import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminRoleController } from './admin-role.controller';
import { AdminUsersController } from './admin-users.controller';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { AuthAttempt } from './entities/auth-attempt.entity';
import { Challenge } from './entities/challenge.entity';
import { DeletionRequest } from './entities/deletion-request.entity';
import { PendingReviewItem } from './entities/pending-review-item.entity';
import { RoleAssignmentRule } from './entities/role-assignment-rule.entity';
import { Session } from './entities/session.entity';
import { SystemConfig } from './entities/system-config.entity';
import { User } from './entities/user.entity';
import { PendingReviewController } from './pending-review.controller';
import { RoleAssignmentService } from './role-assignment.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Session,
      AuthAttempt,
      Challenge,
      RoleAssignmentRule,
      PendingReviewItem,
      DeletionRequest,
      AuditLogEntry,
      SystemConfig,
    ]),
  ],
  controllers: [AuthController, AdminRoleController, AdminUsersController, PendingReviewController],
  providers: [AuthService, AuthGuard, RolesGuard, RoleAssignmentService],
  exports: [AuthService, AuthGuard, RolesGuard, RoleAssignmentService],
})
export class AuthModule {}
