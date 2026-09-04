# Frame - Multi-Tenant SaaS Production Management System

A complete, production-ready full-stack application for aluminum production management with multi-tenancy, user permissions, inventory tracking, project consumption management, and payroll systems.

## 🚀 Features

### Multi-Tenancy
- Isolated company data
- Unique company slugs (frame-companyname)
- Sub-domain support for white-label deployment

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Manager, Supervisor, Staff)
- Granular permission management
- 30-day token expiration

### Inventory Management
- Categories and Subcategories
- Article management with SKU
- Multiple image uploads (file, URL, camera capture)
- Stock level tracking with low-stock alerts
- Unit management (kg, pieces, meters, liters)

### Project Management
- Project creation and tracking
- Consumption tracking (articles used in projects)
- Automatic stock deduction
- Consumption summaries and reports
- Project budget tracking

### Payroll System
- Salary calculations (base + hourly)
- Overtime management
- Bonus and deduction tracking
- Social contributions and tax deductions
- Payment status tracking
- Monthly summaries

### Multi-Language Support
- English (en)
- French (fr)
- Arabic (ar)
- RTL support for Arabic
- Language persistence in localStorage

### User Interface
- Responsive design with Tailwind CSS
- Dark-friendly color scheme
- Toast notifications
- Modal dialogs
- Dropdown menus
- Data tables with search and filter

## 📋 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT
- **Image Storage**: Cloudinary
- **Validation**: express-validator
- **Security**: bcryptjs for password hashing

### Frontend
- **UI Library**: React 18
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Internationalization**: i18next
- **HTTP Client**: Axios
- **Date Handling**: date-fns

## 🏗️ Project Structure

```
frame-saas/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express app setup
│   │   ├── models/                # MongoDB schemas
│   │   ├── controllers/           # Business logic
│   │   ├── routes/                # API endpoints
│   │   ├── middleware/            # Auth & validation
│   │   ├── seeds/                 # Database seeding
│   │   └── utils/                 # Helper functions
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── App.jsx                # Main app component
    │   ├── index.jsx              # React entry point
    │   ├── store.js               # Zustand store (auth state)
    │   ├── api/                   # API calls
    │   ├── pages/                 # Page components
    │   ├── components/            # Reusable components
    │   ├── context/               # React context (toasts)
    │   ├── i18n/                  # i18next translations
    │   └── styles/                # Global styles
    ├── public/
    ├── .env.example
    ├── package.json
    └── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Cloudinary account

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

**Configure `.env`:**
```
MONGODB_URI=mongodb://localhost:27017/frame-saas
JWT_SECRET=your-super-secret-key
PORT=5000
NODE_ENV=development

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

FRONTEND_URL=http://localhost:3000
```

**Run Backend:**
```bash
npm run dev
```

Server runs on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

**Configure `.env`:**
```
REACT_APP_API_URL=http://localhost:5000/api
```

**Run Frontend:**
```bash
npm start
```

App runs on `http://localhost:3000`

### 3. Database Setup

MongoDB will auto-create on first connection. For seeding demo data:

```bash
cd backend
npm run seed
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register company & admin user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Users (Admin/Manager only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/permissions` - Set permissions

### Companies
- `GET /api/companies` - Get company details
- `GET /api/companies/stats` - Get stats
- `PUT /api/companies` - Update company
- `PUT /api/companies/settings` - Update settings

### Permissions (Admin only)
- `GET /api/permissions` - List permissions
- `POST /api/permissions` - Set permission
- `POST /api/permissions/bulk` - Bulk set
- `DELETE /api/permissions/:id` - Delete

### Inventory
- `GET /api/inventory/categories` - List categories
- `POST /api/inventory/categories` - Create category
- `GET /api/inventory/subcategories` - List subcategories
- `GET /api/inventory/articles` - List articles
- `POST /api/inventory/articles` - Create article
- `POST /api/inventory/articles/:id/images` - Add image
- `GET /api/inventory/articles/low-stock` - Low stock alerts

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/projects/:id/consumption` - Add consumption
- `GET /api/projects/:id/summary` - Get summary

### Payroll
- `GET /api/payroll` - List payroll records
- `POST /api/payroll` - Create payroll
- `POST /api/payroll/:id/bonus` - Add bonus
- `POST /api/payroll/:id/approve` - Approve
- `POST /api/payroll/:id/mark-paid` - Mark paid
- `GET /api/payroll/summary/monthly` - Monthly summary

## 🔐 Authentication

Include JWT token in all protected requests:

```bash
Authorization: Bearer <token>
```

Tokens expire in 30 days.

## 🌍 Language Support

Switch languages in UI:
- English (en)
- French (fr)
- Arabic (ar)

Selection persists in localStorage.

## 📦 Deployment

### Heroku
```bash
# Backend
heroku create frame-api-prod
heroku config:set MONGODB_URI=<atlas-uri>
git push heroku main

# Frontend
npm run build
# Deploy build/ to Netlify/Vercel
```

### Docker

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t frame-api .
docker run -p 5000:5000 frame-api
```

### Environment Variables

Production `.env`:
- Set NODE_ENV=production
- Use MongoDB Atlas URI
- Generate secure JWT_SECRET
- Configure CORS properly
- Enable HTTPS

## 📊 Database Models

- **User** - Auth and profile
- **Company** - Tenant isolation
- **Permission** - Fine-grained access control
- **Category** - Inventory categories
- **SubCategory** - Subcategories
- **Article** - Products/materials
- **Project** - Production projects
- **Payroll** - Staff payments

## 🎯 Use Cases

### For Aluminum Manufacturers
- Track raw material stock
- Manage production projects
- Monitor consumption vs. budget
- Manage worker payroll
- Generate reports

### For Other Industries
- Textiles
- Construction
- Food Production
- Pharmaceuticals
- Any product-based manufacturing

## 💼 White-Label SaaS Model

Deploy as multi-tenant SaaS:

1. Each company registers → `frame-companyname.com`
2. Own isolated database
3. Custom branding support
4. Pricing tiers:
   - Starter: €29/month (10 users)
   - Professional: €99/month (50 users)
   - Enterprise: Custom

## 🤝 Support & Customization

- Modify translations in `/frontend/src/i18n/locales/`
- Add custom roles in User model
- Extend inventory with custom fields
- Add reporting dashboards
- Integrate with accounting software

## 📄 License

MIT License

## 🔄 Development Workflow

1. **Local Development**
   ```bash
   npm run dev  # Root runs both backend & frontend
   ```

2. **Testing**
   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```

3. **Build for Production**
   ```bash
   npm run server:build
   npm run client:build
   ```

## 📞 Contact & Support

For questions or customizations, refer to the individual README files in `/backend` and `/frontend`.

---

**Built with ❤️ for Production**
