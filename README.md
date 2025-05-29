
# Farm-Backend

This is the backend server for the Farm application, built with Node.js and Express.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [MongoDB](https://www.mongodb.com/) (ensure it's running locally or provide a connection URI)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/tharun9392/Farm-Backend.git
   cd Farm-Backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory and add the following:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/farmdb
   JWT_SECRET=your_jwt_secret
   ```

   Replace `your_jwt_secret` with a secure secret key.

## Running the Application

- **Start the server:**

  ```bash
  npm start
  ```

- **Development mode with auto-reloading:**

  ```bash
  npm run dev
  ```

  This uses `nodemon` for automatic restarts on file changes.

## Project Structure

```
Farm-Backend/
├── controllers/       # Route handlers
├── middleware/        # Custom middleware
├── models/            # Mongoose schemas
├── routes/            # API routes
├── utils/             # Utility functions
├── validations/       # Request validations
├── public/            # Static files
├── config/            # Configuration files
├── scripts/           # Utility scripts
├── app.js             # Express app setup
├── server.js          # Entry point
├── package.json       # Project metadata
├── .env               # Environment variables
└── README.md          # Project documentation
```

## Deployment

The project includes configurations for deployment:

- **Docker:** Use the provided `Dockerfile` to containerize the application.
- **Render:** The `render.yaml` file can be used for deployment on [Render](https://render.com/).

## License

This project is licensed under the [MIT License](LICENSE).
