# Frame Backend - Multi-Tenant SaaS API

Production-ready Node.js + Express + MongoDB backend for aluminum production management.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Setup Database
- Ensure MongoDB is running (local or Atlas connection)
- Database will be created automatically on first connection

### 4. Run Development Server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

## Project Structure

```
src/
├── server.js           # Main entry point
├── models/            # MongoDB schemas
├── controllers/       # Business logic
├── routes/           # API endpoints
├── middleware/       # Auth, validation
├── config/           # Configuration files
└── seeds/            # Database seeding
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register company & owner
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - List company users
- `GET /api/users/:id` - Get user details
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/permissions` - Update user permissions

### Companies
- `GET /api/companies` - Get company details
- `GET /api/companies/stats` - Get company statistics
- `PUT /api/companies` - Update company
- `PUT /api/companies/settings` - Update settings
- `POST /api/companies/invite` - Invite user

### Permissions
- `GET /api/permissions` - List all permissions
- `GET /api/permissions/user/:userId` - Get user permissions
- `POST /api/permissions` - Create/update permission
- `POST /api/permissions/bulk` - Bulk update permissions
- `DELETE /api/permissions/:permissionId` - Delete permission

### Inventory
- `GET /api/inventory/categories` - List categories
- `POST /api/inventory/categories` - Create category
- `PUT /api/inventory/categories/:id` - Update category
- `DELETE /api/inventory/categories/:id` - Delete category

- `GET /api/inventory/subcategories` - List subcategories
- `POST /api/inventory/subcategories` - Create subcategory
- `PUT /api/inventory/subcategories/:id` - Update subcategory

- `GET /api/inventory/articles` - List articles
- `POST /api/inventory/articles` - Create article
- `PUT /api/inventory/articles/:id` - Update article
- `POST /api/inventory/articles/:id/images` - Add image
- `DELETE /api/inventory/articles/:id` - Delete article
- `GET /api/inventory/articles/low-stock` - Get low stock alerts

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `POST /api/projects/:id/consumption` - Add consumption
- `DELETE /api/projects/:id/consumption` - Remove consumption
- `GET /api/projects/:id/summary` - Get consumption summary
- `DELETE /api/projects/:id` - Delete project

### Payroll
- `GET /api/payroll` - List payroll records
- `GET /api/payroll/:id` - Get payroll details
- `POST /api/payroll` - Create payroll
- `PUT /api/payroll/:id` - Update payroll
- `POST /api/payroll/:id/bonus` - Add bonus
- `POST /api/payroll/:id/deduction` - Add deduction
- `POST /api/payroll/:id/approve` - Approve payroll
- `POST /api/payroll/:id/mark-paid` - Mark as paid
- `GET /api/payroll/summary/monthly` - Get monthly summary

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT token in header:

```
Authorization: Bearer <your-token>
```

## Multi-Tenancy

- Each company is isolated via `company` field
- Users belong to one company
- All data is filtered by company on backend
- Slug-based company URLs: `frame-companyname`

## Image Handling

Images are stored on Cloudinary:
1. Upload via `/articles/:id/images`
2. Supports: Upload, URL, Camera capture
3. Auto-managed deletion on article removal

## Error Handling

Standard error responses:

```json
{
  "error": "Error message",
  "status": 400
}
```

## Development

### Seed Database
```bash
npm run seed
```

### Debug
```bash
DEBUG=frame:* npm run dev
```

## Deployment

1. Set production env vars
2. Use MongoDB Atlas
3. Configure Cloudinary API
4. Deploy to Heroku/Railway/DigitalOcean
5. Set `NODE_ENV=production`

## Security Notes

- Passwords hashed with bcryptjs
- JWT tokens expire in 30 days
- CORS configured for frontend URL
- Admin permissions required for sensitive operations
- Input validation on all endpoints

## Support

For issues or questions, contact the development team.
