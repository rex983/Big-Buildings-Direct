# Big Buildings Direct - Order Management System

A comprehensive order management webapp for tracking building orders from deposit to delivery, with role-based access, file management, real-time communication, and a customer portal.

## Tech Stack

- **Frontend/Backend**: Next.js 15 with TypeScript (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Auth.js v5 (NextAuth) with JWT sessions
- **UI**: Tailwind CSS + shadcn-style components
- **Real-time**: Socket.IO for live messaging
- **File Storage**: Local storage (designed for S3 migration)
- **Email**: Resend

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- (Optional) Resend API key for email functionality

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/big_buildings_direct"
AUTH_SECRET="your-auth-secret-here"
```

3. Initialize the database:

```bash
npm run db:push
npm run db:seed
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

After seeding the database, you can log in with:

- **Admin**: admin@bigbuildingsdirect.com / admin123
- **Sales Rep**: sales@bigbuildingsdirect.com / admin123
- **Customer**: customer@example.com / admin123

## Features

### Order Management
- Full order lifecycle tracking with configurable stages
- Financial tracking (deposits, payments)
- Order timeline visualization
- Activity logging for all changes

### Role-Based Access Control
- Preset roles: Admin, Manager, Sales Rep, Success Team, Customer
- Custom role builder with granular permissions
- Permission categories: Orders, Users, Roles, Files, Documents, Communications, Settings

### File Management
- Drag-and-drop file uploads
- File categorization (contracts, invoices, blueprints, photos)
- Storage abstraction layer (local/S3)
- Preview support for images and PDFs

### Document Signing
- PDF contract uploads
- Electronic signature with HTML5 Canvas
- Signature embedding in PDFs
- Audit trail (IP address, timestamp, user agent)

### Communication
- Internal messaging per order
- Staff-only internal messages
- Real-time delivery via WebSocket
- Email tracking (sent/delivered/opened)

### Customer Portal
- Order status tracking
- Document downloads
- Electronic document signing
- Direct messaging with staff

## Project Structure

```
big-buildings-direct/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── src/
│   ├── app/
│   │   ├── (auth)/      # Login, register, password reset
│   │   ├── (dashboard)/ # Staff dashboard pages
│   │   ├── (portal)/    # Customer portal pages
│   │   └── api/         # API routes
│   ├── components/
│   │   ├── ui/          # Base UI components
│   │   ├── layout/      # Header, sidebar
│   │   └── features/    # Feature-specific components
│   ├── lib/
│   │   ├── prisma.ts    # Database client
│   │   ├── auth.ts      # Authentication
│   │   ├── storage/     # File storage adapters
│   │   ├── email/       # Email service
│   │   └── signing/     # Document signing
│   ├── hooks/           # React hooks
│   └── types/           # TypeScript types
├── server/              # Socket.IO server
└── uploads/             # Local file storage
```

## API Routes

### Orders
- `GET/POST /api/orders` - List/create orders
- `GET/PATCH /api/orders/[orderId]` - Get/update order
- `POST /api/orders/[orderId]/stage` - Advance order stage

### Users & Roles
- `GET/POST /api/users` - List/create users
- `GET/PATCH /api/users/[userId]` - Get/update user
- `GET/POST /api/roles` - List/create roles
- `PUT /api/roles/[roleId]/permissions` - Update role permissions

### Files & Documents
- `POST /api/files` - Upload file
- `GET/DELETE /api/files/[fileId]` - Download/delete file
- `POST /api/documents` - Create document
- `POST /api/documents/[documentId]/send` - Send for signing
- `POST /api/documents/[documentId]/sign` - Sign document

### Messages & Email
- `GET/POST /api/messages` - List/send messages

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push schema to database
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | NextAuth secret key | Yes |
| `AUTH_URL` | Application URL | No |
| `STORAGE_ADAPTER` | `local` or `s3` | No |
| `UPLOAD_DIR` | Local upload directory | No |
| `RESEND_API_KEY` | Resend API key | No |
| `EMAIL_FROM` | Default from email | No |
| `NEXT_PUBLIC_APP_URL` | Public application URL | No |

## License

Private - All rights reserved.
