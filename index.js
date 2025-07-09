require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const passport = require("passport");
const session = require("express-session");

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

app.use(
  session({
    secret: process.env.SESSION_SECRET || "cats",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

function ensureLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// Routes
app.use("/auth", authRoutes);
app.get("/become-member", ensureLoggedIn, (req, res) => {
  res.render("become-member", { user: req.user });
});
app.get("/", (req, res) => {
  res.render("index");
});
app.get("/register", (req, res) => {
  res.render("register");
});
app.get("/login", (req, res) => {
  const successMessage =
    req.query.registered === "true"
      ? "Registration successful! Please log in with your credentials."
      : null;
  res.render("login", { successMessage });
});
app.listen(3000, () => {
  console.log("Server Started on Port 3000");
});
