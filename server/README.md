# 🖥️ Server (Backend) Architecture & API Reference

This is the central Node.js REST API servicing the restaurant management system. Designed for high availability and multi-branch data segregation.

## 📂 Folder Structure
The `server/` directory is structured based on MVC and Domain-Driven patterns.

* `src/`
  * `config/` - Database connection and third-party setups (MongoDB, Cloudinary, Stripe).
  * `controllers/` - Maps business logic functions to endpoints (e.g. `orderController.ts`).
  * `middleware/` - Reusable pipelines like `authMiddleware.ts` (JWT handling) and `errorHandler.ts`.
  * `models/` - Mongoose schemas (User, Order, Branch, Menu, Tables, Reviews, etc.).
  * `routes/` - Express Router definitions hooking HTTP requests to corresponding controllers.
  * `services/` - Helper business logic (e.g., Stripe Payment processing, email sending).
  * `utils/` - Shared helpers (e.g., Token formatters).
* `package.json` - Defines Node dependencies.
* `.env.example` - Security variable blueprint.

## 🔗 Express Routes Used (Full Coverage)

Here are the operational endpoints currently defined within `server/src/routes`:

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create a new user.
- `POST /api/auth/login` - Authenticate user, issue JWT token.
- `GET /api/auth/me` - Get current logged in user details.

### Menu Items (`/api/menu`)
- `GET /api/menu/` - Fetch all paginated menu items.
- `GET /api/menu/featured` - Retrieve featured items.
- `GET /api/menu/deals` - Retrieve deal packages.
- `GET /api/menu/:id` - Fetch single item by ID.
- `POST /api/menu/` - (Admin) Create item w/ Image upload.
- `PATCH /api/menu/:id` - (Admin) Update item.
- `DELETE /api/menu/:id` - (Admin) Remove item.

### Orders (`/api/orders`)
- `POST /api/orders/` - Place order (Dine-in, takeaway, online).
- `GET /api/orders/my-orders` - User retrieves their history.
- `GET /api/orders/stats` - (Admin) Analytical data dashboard logic.
- `GET /api/orders/:id` - View details of specific order.
- `GET /api/orders/:id/status` - Live check status (Public).
- `PATCH /api/orders/:id/status` - (Admin) Change order phase (preparing/finished).
- `PATCH /api/orders/:id/verify-bank` - (Admin) Bank receipt confirmation.
- `POST /api/orders/stripe-webhook` - Background stripe sync logic.

### Booking System (`/api/bookings`)
- `POST /api/bookings/` - Initial reservation request.
- `GET /api/bookings/available` - Poll available slots.
- `PATCH /api/bookings/:id/status` - (Admin) Confirm/Reject booking.

### Branches & Tables (`/api/branches`, `/api/tables`)
- `GET /api/branches/` - Get operational branches.
- `GET /api/branches/:id/tables` - Get mapped tables.
- `POST /api/tables/` - (Admin) Generate new tables.
- `PATCH /api/tables/:id` - Update status/capacity.

### Staff & Management (`/api/chefs`, `/api/categories`, `/api/users`)
- `GET /api/users/`, `GET /api/users/search` - Manage system users.
- `PATCH /api/users/:id/status` - Toggle active/banned status.
- `POST /api/chefs/`, `PATCH /api/chefs/` - Formally upload Chef details.
- `POST /api/categories/` - Manage menu taxonomies.

## 🛠️ Stack Overview
* **Express v5** - Highly concurrent asynchronous request handler.
* **Mongoose (MongoDB)** - Data-layer relational structures using `branchId` mappings.
* **Muxing/Middlewares** - Helmet, CORS, Express-Rate-Limit.
* **JWT (JSON Web Tokens)** - Employs a dual structural Access Token & Refresh Token cycle.
* **Cloudinary** - Stores heavy images globally.
