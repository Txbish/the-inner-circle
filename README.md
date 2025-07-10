<div align="center">
  <a href="#">
    <i class="fas fa-user-secret fa-4x"></i>
  </a>
  <h1 align="center">The Inner Circle</h1>
  <p align="center">
    An exclusive clubhouse for members to share their thoughts away from prying eyes.
    <br />
    <a href="#"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://the-inner-circle.onrender.com/">View Demo</a>
    ·
    <a href="#">Report Bug</a>
    ·
    <a href="#">Request Feature</a>
  </p>
</div>

---

## About The Project

**The Inner Circle** is a Node.js web application that simulates an exclusive, members-only message board. It's built to demonstrate core concepts of web development, including authentication, session management, database integration, and role-based access control.

New users can sign up, but they have limited access. Only by providing a secret code can they become a "member," unlocking the ability to see who authored messages and when they were posted, as well as create their own posts. A special "admin" status grants the power to moderate the board by deleting messages.

### Key Features

- **🔐 Secure User Authentication**: Robust login and registration system using Passport.js.
- **🎭 Role-Based Access**: Three user levels: Non-Member, Member, and Admin.
- **🤫 Exclusive Content**: Message authors and timestamps are hidden from non-members.
- **✍️ Message Board**: Members can create and view detailed messages.
- **👑 Admin Powers**: Admins can delete any message to keep the peace.
- **✨ Flash Notifications**: Users receive contextual feedback for their actions.

---

## 🚀 Tech Stack

This project is built with a modern, robust stack:

| Technology              | Description                                                                     |
| :---------------------- | :------------------------------------------------------------------------------ |
| **Node.js**             | The core runtime environment.                                                   |
| **Express.js**          | A fast, unopinionated, minimalist web framework for Node.js.                    |
| **PostgreSQL**          | A powerful, open-source object-relational database system.                      |
| **EJS**                 | Embedded JavaScript templating for dynamic HTML generation.                     |
| **Passport.js**         | Simple, unobtrusive authentication for Node.js.                                 |
| **Bootstrap 5**         | A popular CSS framework for responsive, mobile-first front-end web development. |
| **`express-session`**   | Session middleware for managing user sessions.                                  |
| **`connect-flash`**     | Middleware for displaying flash messages.                                       |
| **`express-validator`** | Middleware for validating and sanitizing user input.                            |
| **`bcryptjs`**          | A library for hashing passwords securely.                                       |
| **`dotenv`**            | A zero-dependency module that loads environment variables from a `.env` file.   |

---

## 🏁 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v14 or higher)
- npm
- A running PostgreSQL instance

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/txbish/the-inner-circle.git
    ```
2.  **Install NPM packages**
    ```sh
    npm install
    ```
3.  **Set up your environment variables**
    Rename `.env.example` to `.env` and update the values with your actual database credentials and secrets.

4.  **Set up the database**
    Connect to your PostgreSQL instance and run the queries in `database.sql` to create the necessary tables. (You will need to create this file with the table schemas).

5.  **Run the application**
    ```sh
    npm start
    ```
    The application will be available at `http://localhost:3000`.

---

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
