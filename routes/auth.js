const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const pool = require("../db.js");
const passport = require("passport");
const LocalPassport = require("passport-local");

function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query("Select * from users where id =$1", [id]);
    if (result.rows[0]) {
      done(null, result.rows[0]);
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error);
  }
});
passport.use(
  new LocalPassport.Strategy(async (username, password, done) => {
    try {
      const result = await pool.query(
        "Select * from users where username = $1 OR email = $1",
        [username]
      );
      if (!result.rows[0]) {
        return done(null, false, { message: "User not found" });
      }
      const user = result.rows[0];
      const matched = await bcrypt.compare(password, user.password);
      if (!matched) {
        return done(null, false, { message: "Password does not match" });
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  })
);

router.post(
  "/login",
  [
    body("username")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Username or email is required")
      .escape(),

    body("password").isLength({ min: 1 }).withMessage("Password is required"),
  ],
  (req, res, next) => {
    // Check for validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.render("login", {
        error: errorMessages.join(". "),
        formData: req.body,
      });
    }

    // Proceed with passport authentication if validation passes
    passport.authenticate("local", {
      successRedirect: "/messages",
      failureRedirect: "/login",
      failureFlash: true,
    })(req, res, next);
  }
);

router.post(
  "/register",
  [
    body("first_name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be between 2 and 50 characters")
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage("First name can only contain letters and spaces"),

    body("last_name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be between 2 and 50 characters")
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage("Last name can only contain letters and spaces"),

    body("username")
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores"
      ),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 6, max: 100 })
      .withMessage("Password must be at least 6 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),

    body("confirm_password").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        req.flash("formData", req.body);
        return res.redirect("/register");
      }

      const { first_name, last_name, username, email, password, admin_code } =
        req.body;

      const isAdmin = admin_code === process.env.ADMIN_SECRET_CODE;
      const isMember = isAdmin; // Admins are always members

      const existingUser = await pool.query(
        "SELECT * FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        req.flash(
          "error",
          "Username or email already exists. Please choose different ones."
        );
        req.flash("formData", req.body);
        return res.redirect("/register");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await pool.query(
        "INSERT INTO users (first_name, last_name, username, email, password, is_admin, is_member) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email",
        [
          first_name,
          last_name,
          username,
          email,
          hashedPassword,
          isAdmin,
          isMember,
        ]
      );

      req.flash(
        "success",
        "Registration successful! Please log in with your credentials."
      );
      res.redirect("/login");
    } catch (error) {
      console.error("Registration error:", error);
      req.flash(
        "error",
        "An error occurred during registration. Please try again."
      );
      req.flash("formData", req.body);
      return res.redirect("/register");
    }
  }
);

router.post(
  "/become-member",
  ensureLoggedIn,
  [
    body("secret_code")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Passcode is required"),
  ],
  async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).render("login", {
          error: "Please log in to become a member",
        });
      }

      // Handle validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("become-member", {
          error: errors.array()[0].msg,
          formData: req.body,
          user: req.user,
        });
      }

      if (req.user.is_member) {
        return res.render("become-member", {
          success: "You are already a member!",
          user: req.user,
        });
      }

      // Update membership status
      if (req.body.secret_code !== process.env.MEMBER_CODE) {
        req.flash("error", "The secret passcode is incorrect.");
        return res.redirect("/become-member");
      }

      const { rowCount } = await pool.query(
        "UPDATE users SET is_member = true WHERE id = $1",
        [req.user.id]
      );

      if (rowCount === 0) {
        throw new Error("User not found or could not update");
      }

      // Update the user object for the session
      req.user.is_member = true;
      req.flash("successMessage", "Congratulations! You have become a member.");
      res.redirect("/dashboard");
    } catch (error) {
      console.error("Error changing membership status:", error);
      req.flash("error", "An error occurred. Please try again.");
      res.redirect("/become-member");
    }
  }
);

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie("members_only_session");
      res.redirect("/");
    });
  });
});

router.post(
  "/create-message",
  ensureLoggedIn,
  [
    body("title")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Title must be between 1 and 100 characters"),
    body("text")
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Content must be between 1 and 2000 characters"),
  ],
  async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).render("login", {
          error: "Please log in to post a message",
        });
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("create-message", {
          error: errors.array()[0].msg,
          formData: req.body,
          user: req.user,
        });
      }

      const { title, text } = req.body;

      const result = await pool.query(
        "INSERT INTO messages (author_id, title, content) VALUES ($1, $2, $3) RETURNING *",
        [req.user.id, title, text]
      );

      if (result.rows[0]) {
        req.flash("successMessage", "Message created successfully!");
        return res.redirect("/messages");
      } else {
        return res.render("create-message", {
          error: "Unable to create message",
          formData: req.body,
          user: req.user,
        });
      }
    } catch (error) {
      console.error("Create message error:", error);
      return res.render("create-message", {
        error:
          "An error occurred while creating the message. Please try again.",
        formData: req.body,
        user: req.user,
      });
    }
  }
);
router.get("/messages", ensureLoggedIn, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.id,
        m.title,
        m.content,
        m.created_at,
        u.first_name,
        u.last_name
      FROM messages m
      JOIN users u ON m.author_id = u.id
      ORDER BY m.created_at DESC
    `);

    const messages = result.rows.map((row) => ({
      _id: row.id,
      title: row.title,
      text: row.content,
      timestamp: row.created_at,
      user: {
        first_name: row.first_name,
        last_name: row.last_name,
      },
    }));

    return res.render("dashboard", {
      messages: messages,
      user: req.user,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.render("dashboard", {
      error: "An error occurred while fetching messages. Please try again.",
      messages: [],
      user: req.user,
    });
  }
});
router.post("/delete-message/:id", ensureLoggedIn, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).send("You are not authorized to delete messages.");
    }
    const messageId = req.params.id;
    await pool.query("DELETE FROM messages WHERE id = $1", [messageId]);
    req.flash("successMessage", "Message deleted successfully.");
    res.redirect("/messages");
  } catch (error) {
    console.error("Error deleting message:", error);
    req.flash("error", "Error deleting message.");
    res.redirect("/messages");
  }
});

module.exports = router;
