const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { syncEmployeeIndexes } = require('./utils/syncEmployeeIndexes');
const cors = require('cors');
const compression = require('compression');

// Load .env from THIS file's directory explicitly, rather than
// relying on `dotenv`'s default (the process's current working
// directory). If the server is ever started from a different cwd
// (a root-level npm script, a process manager, a monorepo task
// runner, ...), the bare `require('dotenv').config()` silently
// finds no .env file and every var — including TRANSLATION_PROVIDER
// — is just missing, with no error. This is a common source of
// "I edited .env but nothing changed" bugs.
//
// `override: true`: by default dotenv NEVER overwrites a variable
// that already exists in process.env — including one that's already
// set to an EMPTY string. On Windows especially, it's easy to end up
// with a stray TRANSLATION_PROVIDER="" (or any other var) already
// sitting in the shell/session/system environment from earlier
// experimentation, which then silently wins over .env forever, no
// matter how many times .env is edited or the server is restarted.
// For a project-local .env like this one, the file should always be
// the source of truth, so we force it to win.
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

// One-line startup diagnostic: makes a misconfigured/missing .env
// immediately visible in the server console instead of only
// surfacing later as a confusing 503 on a translation request.
console.log(
  `[env] Loaded .env from ${path.join(__dirname, '.env')} — ` +
  `TRANSLATION_PROVIDER=${JSON.stringify(process.env.TRANSLATION_PROVIDER || '')}`
);

const { runDailyHRChecks } = require('./services/scheduledNotificationsService');
const { generalRateLimiter } = require('./middleware/rateLimitMiddleware');

const authRoutes = require('./routes/auth');
const { router: twoFactorRoutes } = require('./routes/twoFactor');
const userRoutes = require('./routes/users');
const companyRoutes = require("./routes/companies");  
const employeeRoutes = require("./routes/employees");
const salaryRoutes = require("./routes/salaries");
const absenceRoutes = require("./routes/absences");
const advanceRoutes = require("./routes/advances");
const payrollRoutes = require("./routes/payroll");
const contractRoutes = require("./routes/contracts");
const documentRoutes = require("./routes/documents");
const attendanceRoutes = require("./routes/attendance");
const notificationRoutes = require("./routes/notifications");
const auditLogRoutes = require("./routes/auditLogs");
const reportRoutes = require("./routes/reports");
const meRoutes = require("./routes/me");
const workScheduleRoutes = require("./routes/workSchedule");
const inventoryCategoryRoutes = require("./routes/inventoryCategories");
const departmentRoutes = require("./routes/departments");
const jobPositionRoutes = require("./routes/jobPositions");
const productRoutes = require("./routes/products");
const purchaseRequestRoutes = require("./routes/purchaseRequests");
const performanceReviewRoutes = require("./routes/performanceReviews");
const disciplinaryActionRoutes = require("./routes/disciplinaryActions");
const holidayRoutes = require("./routes/holidays");
const supplierRoutes = require("./routes/suppliers");
const purchaseOrderRoutes = require("./routes/purchaseOrders");
const priceRequestRoutes = require("./routes/priceRequests");

const app = express();

// Middleware
// gzip/brotli-compresses every JSON response before it goes over
// the wire — free bandwidth/latency win on every request, not just
// initial page load, since API responses (employee lists, payroll
// runs, reports) are plain JSON and compress very well. Placed
// before express.json() so it also covers static/other middleware
// output, not just the API routes below.
app.use(compression());
app.use(express.json());

// ------------------------------------------------------------
// SCHEDULED JOBS
// ------------------------------------------------------------
// Runs the daily HR expiry check (contracts, employee documents —
// see scheduledNotificationsService.js) once at startup, then every
// 24h after that. A plain setInterval is enough for "once a day" —
// no need for a cron library or its extra dependency for a schedule
// this simple. Started only after MongoDB actually connects (see
// the mongoose.connect().then() below), so it can't run queries
// against a database that isn't ready yet.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const { runDailyPurchasingChecks } = require('./services/purchasingScheduledChecks');

function startScheduledJobs() {
  runDailyHRChecks();
  runDailyPurchasingChecks();
  setInterval(() => { runDailyHRChecks(); runDailyPurchasingChecks(); }, ONE_DAY_MS);
}

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✓ Connected to MongoDB');
    await syncEmployeeIndexes();
    startScheduledJobs();
  })
  .catch(err => console.error('MongoDB connection error:', err));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

// CORS_ORIGINS is a comma-separated list, e.g.
// "https://your-app.vercel.app,https://your-app-git-preview.vercel.app".
// FRONTEND_URL (a single URL) is also supported as a fallback — it
// was already documented in .env.example for exactly this purpose,
// but nothing actually read it before now; this line is what
// finally makes it do something. Defaults to the local Vite dev
// server so nothing changes for local development without a .env —
// this only needs setting once the frontend is actually deployed
// somewhere other than localhost. Requests with no Origin header at
// all (server-to-server calls, curl, health checks) are always
// allowed through, since CORS is a browser-enforced concept —
// there's nothing to protect against for a request that was never
// going to carry a browser's cookies in the first place.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS: rejected request from origin "${origin}" — not in CORS_ORIGINS`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true  // ← Important!
}));

// General, defense-in-depth rate limiting across the whole API —
// see middleware/rateLimitMiddleware.js. The stricter, brute-force-
// specific limiter for POST /api/auth/login is applied directly on
// that route instead (routes/auth.js), since it needs a much lower
// threshold than everything else in the app.
app.use('/api', generalRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/absences", absenceRoutes);
app.use("/api/advances", advanceRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/me", meRoutes);
app.use("/api/work-schedule", workScheduleRoutes);
app.use("/api/inventory-categories", inventoryCategoryRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/job-positions", jobPositionRoutes);
app.use("/api/products", productRoutes);
app.use("/api/purchase-requests", purchaseRequestRoutes);
app.use("/api/performance-reviews", performanceReviewRoutes);
app.use("/api/disciplinary-actions", disciplinaryActionRoutes);
app.use("/api/holidays", holidayRoutes);
// Purchasing module (service achats)
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/price-requests", priceRequestRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Server error'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
