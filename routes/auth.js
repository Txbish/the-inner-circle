const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const pool = require("../db.js");
const passport = require("passport");
const LocalPassport = require("passport-local");

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
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.render("login", {
          error: info.message,
          formData: req.body,
        });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  }
);

router.post(
  "/register",
  [
    body("first-name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be between 2 and 50 characters")
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage("First name can only contain letters and spaces"),

    body("last-name")
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

    body("confirm-password").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

    body("admin")
      .isIn(["admin", "normal"])
      .withMessage("Please select a valid account type"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => error.msg);
        return res.render("register", {
          error: errorMessages.join(". "),
          formData: req.body,
        });
      }

      const {
        "first-name": firstName,
        "last-name": lastName,
        username,
        email,
        password,
        admin,
      } = req.body;

      const existingUser = await pool.query(
        "SELECT * FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.render("register", {
          error:
            "Username or email already exists. Please choose different ones.",
          formData: { firstName, lastName, username, email, admin },
        });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const isAdmin = admin === "admin";

      const newUser = await pool.query(
        "INSERT INTO users (first_name, last_name, username, email, password, is_admin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email",
        [firstName, lastName, username, email, hashedPassword, isAdmin]
      );

      res.redirect("/login?registered=true");
    } catch (error) {
      console.error("Registration error:", error);
      res.render("register", {
        error: "An error occurred during registration. Please try again.",
        formData: req.body,
      });
    }
  }
);

router.post(
  "/become-member",
  [
    body("passcode")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Passcode can't be empty")
      .custom((value) => {
        if (value !== process.env.MEMBER_CODE) {
          throw new Error("Invalid passcode");
        }
        return true;
      }),
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
      const { rowCount } = await pool.query(
        "UPDATE users SET is_member = true WHERE id = $1",
        [req.user.id]
      );

      if (rowCount === 0) {
        throw new Error("User not found or could not update");
      }

      // Update the user object for the session
      req.user.is_member = true;

      res.render("become-member", {
        success: "Congratulations! You are now a member!",
        user: req.user,
      });
    } catch (error) {
      console.error("Error changing membership status:", error);
      res.status(500).render("become-member", {
        error: "An error occurred. Please try again.",
        formData: req.body,
        user: req.user,
      });
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

module.exports = router;
