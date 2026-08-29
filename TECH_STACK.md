# NEU Companion Application - Technology Stack

## Overview

NEU Companion is a university companion platform built as a **monorepo** using modern Node.js and TypeScript technologies. The application prioritizes type safety, scalability, and maintainability through a carefully selected set of production-grade frameworks and libraries.

---

## Backend API

### Core Framework
- **NestJS** (11.2.3) — Progressive Node.js framework for building scalable, maintainable server-side applications
  - Architecture: Modular, decorator-based dependency injection
  - HTTP handler: Express.js (underlying HTTP adapter)
  - Package: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`

### Language & Type System
- **TypeScript** (5.9.3) — Strongly-typed superset of JavaScript
- **Node.js** (22) — JavaScript runtime (LTS)
- **ts-node** (10.9.2) — Execute TypeScript directly without compilation step

### Database & ORM
- **PostgreSQL** (16-alpine, via Docker) — Relational database for persistent data storage
- **TypeORM** (1.1.0) — Object-relational mapper for type-safe database queries
  - Decorators for entity and column definitions
  - Query builder and repository patterns
  - Support for migrations and relations
- **pg** (8.23.0) — PostgreSQL client library for Node.js

### Caching & Sessions
- **Redis** (7-alpine, via Docker) — In-memory cache and session store
  - Current use: Reserved for future session optimization
  - Can be extended for real-time features and rate limiting

### Authentication & Authorization
- **Google Auth Library** (11.0.2) — OAuth 2.0 verification for Google Identity
  - ID token verification for secure provider integration
  - Fallback to local-dev mode for development without GOOGLE_CLIENT_ID
- **Cookie-parser** (1.4.7) — Parse and manage HTTP cookies for session handling
- **Custom Auth Guards & Decorators** — Role-based access control (RBAC) infrastructure

### Utilities
- **class-validator** (0.15.1) — Declarative validation decorators
- **class-transformer** (0.5.1) — Transform and serialize class instances
- **RxJS** (7.6.2) — Reactive programming library (used by NestJS internally)
- **reflect-metadata** (0.1.0) — Polyfill for metadata reflection (required by TypeORM and NestJS)

---

## Development & Testing

### Build & Runtime
- **NestJS CLI** (11.0.24) — Command-line tooling for scaffolding and building NestJS projects
- **NestJS Schematics** (11.1.0) — Code generation templates for NestJS artifacts

### Testing Framework
- **Jest** (29.7.0) — JavaScript testing framework
  - Config: `NODE_OPTIONS=--experimental-vm-modules` for ES modules support
- **ts-jest** (29.4.12) — Jest transformer for TypeScript
- **@nestjs/testing** (11.2.3) — NestJS testing utilities and module test harness
- **@types/jest** (29.5.0) — TypeScript type definitions for Jest

### Code Quality
- **TypeScript compiler** — Type checking and compilation
- **tsconfig-paths** (4.0.0) — Resolve TypeScript paths at runtime

### Type Definitions
- **@types/express** (5.0.6) — TypeScript types for Express.js
- **@types/node** (22.10.1) — TypeScript types for Node.js APIs
- **@types/cookie-parser** (1.4.10) — TypeScript types for cookie-parser

---

## Infrastructure & Deployment

### Containerization
- **Docker** — Containerized services for PostgreSQL and Redis
- **Docker Compose** (via `docker-compose.yml`) — Local development orchestration
  - Services: PostgreSQL 16-alpine, Redis 7-alpine
  - Volume persistence for development data
  - Environment-based configuration

### Configuration Management
- **@nestjs/config** (12.0.0) — Environment variable and .env file handling
  - Centralized application configuration
  - Support for validation schemas

---

## Project Structure

### Monorepo Layout
```
/
├── apps/
│   └── api/                    # NestJS API application (@neu-companion/api)
│       ├── src/
│       │   ├── auth/           # Authentication & authorization domain
│       │   ├── app.module.ts   # Main application module
│       │   └── main.ts         # Entry point
│       ├── package.json        # API-specific dependencies
│       └── tsconfig.json       # TypeScript configuration
├── docker-compose.yml          # Local infrastructure (PostgreSQL 16, Redis 7)
├── package.json                # Root workspace configuration (neu-companion)
└── docs/                        # API design and implementation plans
```

### Module Architecture
- **Auth Module** — Handles identity, sessions, role-based access, and admin operations
  - Controllers: AuthController, AdminRoleController, AdminUsersController, PendingReviewController
  - Services: AuthService, RoleAssignmentService
  - Guards: AuthGuard, RolesGuard
  - Entities: User, Session, Challenge, PendingReviewItem, AuditLogEntry, RoleAssignmentRule, SystemConfig

---

## Key Design Patterns

### 1. Modular Architecture
- NestJS modules encapsulate related features (auth, users, courses, etc.)
- Clear separation of concerns: controllers, services, entities, guards

### 2. Dependency Injection
- NestJS built-in IoC container for automatic service instantiation
- Constructor-based dependency injection for testability

### 3. Type Safety
- End-to-end TypeScript for compile-time type checking
- TypeORM for type-safe database operations
- Decorator-based validation (class-validator)

### 4. Authentication Flow
- **Session-based**: Cookie-backed token validation
- **Provider-based**: Google OAuth 2.0 integration with fallback
- **Multi-factor**: Challenge-response flow for sensitive operations (step-up verification)

### 5. Authorization Model
- **Role-based Access Control (RBAC)**: student, professor, admin, pending
- **Decorator-driven guards**: `@Roles()` for route-level enforcement
- **Fresh verification enforcement**: Time-bounded step-up checks for privileged actions

### 6. Audit Logging
- Immutable audit log for all admin operations and role changes
- Actor tracking and action metadata storage

---

## Development Workflow

### Local Setup
```bash
# Install dependencies
npm install

# Start infrastructure (PostgreSQL + Redis)
npm run db:up

# Run API in watch mode
npm run dev:api

# Build for production
npm run build

# Start production server
npm run start:api
```

### Testing
```bash
# Run all tests
npm --workspace apps/api test

# Run tests in watch mode
npm --workspace apps/api test:watch

# Generate coverage report
npm --workspace apps/api test:cov
```

---

## Deployment Considerations

### Database
- **PostgreSQL** with UUID extensions
- **TypeORM migrations** for schema versioning (future)
- Indexes on high-query columns for performance

### Sessions & Caching
- **Redis** ready for session store optimization
- Cookie-based token hashing with SHA-256

### Authentication
- **Google OAuth** integration (production)
- **Local-dev fallback** when GOOGLE_CLIENT_ID is unset (development)

### Scalability
- Stateless API design (sessions stored in database)
- Ready for horizontal scaling behind load balancer
- Redis can be leveraged for distributed caching

---

## Performance & Security

### Performance
- TypeORM query builder with indexing support
- Cursor-based pagination for user search
- Cookie-based sessions (no JWT overhead)
- Production build optimization via NestJS compiler

### Security
- **Password-less authentication** via Google OAuth
- **Session validation** with token hashing (SHA-256)
- **CSRF protection** via cookie attributes (SameSite=Lax)
- **Step-up verification** for sensitive admin actions
- **Audit logging** for compliance and forensics
- **Role-based guards** to enforce authorization
- Environment-based secret management

---

## Future Extensibility

### Planned Additions (from implementation plan)
- Mobile app workspace (React Native + Expo) for iOS/Android
- Additional auth providers (SAML, custom directory)
- Real-time features (WebSockets via Socket.io)
- Cron jobs and background processing (Bull + Redis)
- API documentation (Swagger/OpenAPI)
- Advanced monitoring and observability

### Technology Gaps
- Containerized deployment (Docker images for API)
- CI/CD pipeline (GitHub Actions, GitLab CI)
- Rate limiting (express-rate-limit)
- Structured logging (Winston, Pino)
- Health checks and metrics (Prometheus)

---

## Version Summary

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22 | JavaScript runtime |
| TypeScript | 5.9.3 | Type-safe language |
| NestJS | 11.2.3 | API framework |
| PostgreSQL | 16-alpine | Database |
| Redis | 7-alpine | Cache & session store |
| TypeORM | 1.1.0 | Database ORM |
| Google Auth | 11.0.2 | OAuth provider |
| Jest | 29.7.0 | Test framework |

---

## Dependencies Graph

```
┌─────────────────────┐
│   TypeScript        │
│   (Type System)     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   NestJS 11.2.3     │
│   (Framework)       │
├─────────────────────┤
│ • Express.js        │
│ • class-validator   │
│ • RxJS              │
│ • reflect-metadata  │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────────┐ ┌─▼──────────────┐
│ TypeORM    │ │ Authentication │
│ • pg       │ │ • Google Auth  │
│ • Postgres │ │ • cookie-parser│
└──────┬─────┘ └────────────────┘
       │
┌──────▼─────────┐
│ Infrastructure │
│ • Docker       │
│ • Postgres 16  │
│ • Redis 7      │
└────────────────┘
```

---

**Application:** NEU Companion (neu-companion)  
**Last Updated:** 2026-08-30  
**Status:** Foundation phase complete, ready for Domain 2 (Courses & Enrollment) implementation
