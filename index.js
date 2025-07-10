require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const passport = require("passport");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const pool = require("./db");
const flash = require("connect-flash");

const authRoutes = require("./routes/auth");
const app = express();

console.log("🚀 Starting Express application...");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    store: new pgSession({
      pool: pool, // Connection pool
      tableName: "user_sessions", // Table name for sessions
      createTableIfMissing: true, // Create table if it doesn't exist
    }),
    name: "members_only_session", // Session name
    secret: process.env.SESSION_SECRET || "cats",
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // Set to true in production with HTTPS
      httpOnly: true, // Prevent XSS attacks
      sameSite: "lax", // CSRF protection
    },
  })
);

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// Routes
app.use("/", authRoutes);

app.get("/become-member", ensureLoggedIn, (req, res) => {
  res.render("become-member", {
    user: req.user,
    error: req.flash("error"),
    successMessage: req.flash("successMessage"),
  });
});

app.get("/create-message", ensureLoggedIn, (req, res) => {
  if (!req.user.is_member) {
    return res.render("become-member", {
      error: "You need to become a member first to create messages.",
      user: req.user,
    });
  }
  res.render("create-message", { user: req.user });
});

app.get("/dashboard", ensureLoggedIn, (req, res) => {
  res.redirect("/messages");
});

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});
app.get("/register", (req, res) => {
  res.render("register", {
    user: req.user,
    error: req.flash("error")[0]?.msg || [],
    formData: req.flash("formData")[0],
  });
});
app.get("/login", (req, res) => {
  const successMessage = req.flash("success");
  res.render("login", {
    successMessage,
    user: req.user,
    error: req.flash("error"),
  });
});
app.listen(3000, () => {
  console.log("Server Started on Port 3000");
});
