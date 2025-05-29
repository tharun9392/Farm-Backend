# Farm Management System Backend

A robust Node.js/Express.js backend application for managing farm operations, inventory, orders, and more. This system provides a complete solution for agricultural business management with features like user authentication, product management, order processing, and financial tracking.

## 🚀 Features

### Core Functionality
- **User Management**
  - Authentication and Authorization
  - Role-based access control (Admin, Farmer, Customer)
  - User profile management
  - Secure password handling

- **Product Management**
  - Product catalog
  - Inventory tracking
  - Stock management
  - Product images and details

- **Order System**
  - Order processing
  - Order tracking
  - Delivery management
  - Order history

- **Financial Management**
  - Payment processing (Razorpay integration)
  - Sales tracking
  - Financial reporting
  - Invoice generation (PDF)

### Additional Features
- **Communication**
  - In-app messaging system
  - Notification system
  - Announcements
  - Email notifications (SendGrid)

- **Task Management**
  - Task creation and assignment
  - Progress tracking
  - Due date management

- **Reporting**
  - Sales reports
  - Inventory reports
  - Custom report generation
  - Data export capabilities

## 🛠️ Technical Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **File Handling**: Multer
- **Documentation**: PDF generation with PDFKit
- **Payment**: Razorpay Integration
- **Email**: SendGrid
- **Logging**: Winston and Morgan
- **Security**:
  - Helmet (HTTP headers)
  - XSS protection
  - Rate limiting
  - MongoDB sanitization
  - HTTP Parameter Pollution protection

## 📋 Prerequisites

- Node.js (version 18 or higher)
- MongoDB (local or Atlas URI)
- npm or yarn
- SendGrid API Key (for email functionality)
- Razorpay API Keys (for payment processing)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd farm-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `config.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/farm-db

   # JWT Configuration
   JWT_SECRET=your-secure-jwt-secret
   JWT_EXPIRES_IN=90d

   # Email Configuration (SendGrid)
   SENDGRID_API_KEY=your-sendgrid-api-key
   EMAIL_FROM=your-verified-sender-email

   # Razorpay Configuration
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-secret

   # Frontend URL (CORS)
   FRONTEND_URL=http://localhost:3000
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Scripts
- `npm start`: Start the production server
- `npm run dev`: Start development server with nodemon
- `npm run build`: Install dependencies
- `npm test`: Run tests (when implemented)

## 📁 Project Structure

```
├── app.js                 # Main application setup
├── server.js             # Server entry point
├── config/               # Configuration files
├── controllers/          # Route controllers
├── middleware/          # Custom middleware
├── models/              # Database models
├── routes/              # API routes
├── utils/               # Utility functions
├── validations/         # Input validation
├── public/              # Static files
└── scripts/             # Utility scripts
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting for API endpoints
- XSS protection
- NoSQL injection prevention
- Security headers with Helmet
- CORS configuration
- File upload security
- Request sanitization

## 📦 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order

### Payments
- `POST /api/payments/create` - Create payment
- `POST /api/payments/verify` - Verify payment

## 🚢 Deployment

### Docker Deployment
```bash
# Build Docker image
docker build -t farm-backend .

# Run Docker container
docker run -p 3000:3000 farm-backend
```

### Platform Deployment
- Includes configuration for Render (`render.yaml`)
- Supports deployment on any Node.js hosting platform
- Environment variable configuration required

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ✨ Acknowledgments

- Node.js community
- Express.js team
- MongoDB team
- All contributors to the project
