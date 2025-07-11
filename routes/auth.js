const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const prisma = require("../db.js");
const passport = require("passport");
const LocalPassport = require("passport-local");

function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    // Use Prisma to find the user by ID
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
    });
    done(null, user);
  } catch (error) {
    done(error);
  }
});
passport.use(
  new LocalPassport.Strategy(async (username, password, done) => {
    try {
      // Use Prisma to find a user by username or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: username }, { email: username }],
        },
      });

      if (!user) {
        return done(null, false, { message: "User not found" });
      }
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

      // Use Prisma to check if user exists
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username: username }, { email: email }] },
      });

      if (existingUser) {
        req.flash(
          "error",
          "Username or email already exists. Please choose different ones."
        );
        req.flash("formData", req.body);
        return res.redirect("/register");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Use Prisma to create a new user
      await prisma.user.create({
        data: {
          first_name,
          last_name,
          username,
          email,
          password: hashedPassword,
          is_admin: isAdmin,
          is_member: isMember,
        },
      });

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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("become-member", {
        error: errors.array()[0].msg,
        user: req.user,
      });
    }

    try {
      const { secret_code } = req.body;

      if (secret_code !== process.env.MEMBER_SECRET_CODE) {
        return res.render("become-member", {
          error: "Incorrect passcode. Please try again.",
          user: req.user,
        });
      }

      // Use Prisma to update the user's membership status
      await prisma.user.update({
        where: { id: req.user.id },
        data: { is_member: true },
      });

      req.flash(
        "successMessage",
        "Congratulations! You are now a full member."
      );
      res.redirect("/messages");
    } catch (error) {
      console.error("Membership update error:", error);
      res.render("become-member", {
        error: "An error occurred while updating your membership.",
        user: req.user,
      });
    }
  }
);

router.get("/messages", ensureLoggedIn, async (req, res) => {
  try {
    // Use Prisma to get all messages and include author details
    const messagesFromDb = await prisma.message.findMany({
      include: {
        author: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const messages = messagesFromDb.map((msg) => ({
      id: msg.id,
      title: msg.title,
      text: msg.content,
      timestamp: msg.created_at,
      user: msg.author,
      is_admin: req.user.is_admin,
    }));

    return res.render("dashboard", {
      messages: messages,
      user: req.user,
      successMessage: req.flash("successMessage"),
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
    const messageId = parseInt(req.params.id, 10);
    // Use Prisma to delete the message
    await prisma.message.delete({ where: { id: messageId } });
    req.flash("successMessage", "Message deleted successfully.");
    res.redirect("/messages");
  } catch (error) {
    console.error("Error deleting message:", error);
    req.flash("error", "Error deleting message.");
    res.redirect("/messages");
  }
});

module.exports = router;
