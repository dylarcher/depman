# packman

A powerful CLI tool and IDE extension to streamline project dependencies and NodeJS version maintenance.

```shell
project-root/
├── apps/                     # Contains individual applications (frontend, backend)
│   ├── client/               # Next.js frontend application
│   │   ├── app/              # Next.js App Router directory
│   │   │   ├── (auth)/       # Route group for authentication pages (e.g., sign-in, sign-up)
│   │   │   │   ├── sign-in/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── sign-up/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (app)/        # Route group for main application pages (e.g., dashboard)
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── api/          # API routes handled by Next.js (e.g., for Auth.js)
│   │   │   │   └── auth/[...nextauth]/route.ts
│   │   │   ├── layout.tsx    # Root layout for the client app
│   │   │   └── page.tsx      # Root page (e.g., landing page)
│   │   ├── components/       # React components for the client app
│   │   │   ├── ui/           # Shadcn/UI components (or other general UI elements)
│   │   │   ├── shared/       # Custom shared components specific to this app
│   │   │   └── icons/        # Custom SVG icons or icon components
│   │   ├── lib/              # Client-specific utility functions, hooks, context
│   │   │   ├── auth.ts       # Auth.js configuration
│   │   │   └── utils.ts      # General client-side utilities
│   │   ├── public/           # Static assets (images, fonts, etc.)
│   │   ├── styles/           # Global styles, Tailwind CSS base
│   │   │   └── globals.css
│   │   ├── .env.local        # Local environment variables for client
│   │   ├── next.config.mjs   # Next.js configuration
│   │   ├── postcss.config.js # PostCSS configuration (for Tailwind)
│   │   ├── tailwind.config.ts # Tailwind CSS configuration
│   │   └── package.json      # Dependencies and scripts for the client app
│   │
│   └── server/               # NestJS backend application
│       ├── src/              # Source code for the server app
│       │   ├── auth/         # Authentication module (controllers, services, strategies)
│       │   ├── users/        # Users module
│       │   ├── billing/      # Billing/payments module (e.g., Stripe integration)
│       │   ├── common/       # Common modules, decorators, pipes, guards
│       │   ├── app.module.ts # Root module for the server app
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts       # Entry point for the NestJS application
│       ├── test/             # End-to-end and unit tests for the server
│       ├── .env              # Environment variables for server
│       ├── nest-cli.json     # NestJS CLI configuration
│       ├── tsconfig.build.json # TypeScript build configuration
│       ├── tsconfig.json     # TypeScript configuration
│       └── package.json      # Dependencies and scripts for the server app
│
├── packages/                 # Shared code/packages used across applications
│   ├── db/                   # Prisma schema, client, migrations, and seed scripts
│   │   ├── prisma/
│   │   │   ├── migrations/   # Database migration files
│   │   │   ├── schema.prisma # Prisma schema file
│   │   │   └── seed.ts       # Script for seeding the database
│   │   ├── client.ts         # Exports configured Prisma client instance
│   │   ├── package.json      # Package definition for @project/db
│   │   └── tsconfig.json
│   │
│   ├── ui/                   # Shared UI components (e.g., for Storybook, or if used by multiple frontends)
│   │   ├── src/
│   │   │   └── Button.tsx    # Example shared component
│   │   ├── package.json      # Package definition for @project/ui
│   │   └── tsconfig.json
│   │
│   ├── config/               # Shared configurations (ESLint, Prettier, TypeScript)
│   │   ├── eslint-preset.js  # Shared ESLint configuration
│   │   ├── prettier-preset.js # Shared Prettier configuration
│   │   └── tsconfig/         # Shared TypeScript configurations (base, nextjs, nestjs)
│   │       ├── base.json
│   │       ├── nextjs.json
│   │       └── nestjs.json
│   │
│   ├── utils/                # Shared utility functions and types (e.g., Zod schemas)
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json      # Package definition for @project/utils
│   │   └── tsconfig.json
│
├── .github/                  # GitHub specific files (e.g., workflows for CI/CD)
│   └── workflows/
│       └── ci.yml
│
├── .storybook/               # Storybook global configuration files
│   ├── main.js               # Or main.ts
│   └── preview.js            # Or preview.ts
│
├── .env                      # Root environment variables (e.g., DATABASE_URL for Prisma)
├── .env.example              # Example environment variables
├── .eslintrc.js              # Root ESLint configuration (can extend from packages/config)
├── .gitignore                # Specifies intentionally untracked files
├── .prettierrc.js            # Root Prettier configuration (can extend from packages/config)
├── package.json              # Root package.json (for overall project scripts, and NPM workspaces if used)
└── tsconfig.json             # Root TypeScript configuration (for path aliases to packages)

```
