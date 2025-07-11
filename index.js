require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const passport = require("passport");
const session = require("express-session");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const prisma = require("./db");
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
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, //ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
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
    title: "Become a Member",
    user: req.user,
    error: req.flash("error"),
    successMessage: req.flash("successMessage"),
  });
});

app.post("/create-message", ensureLoggedIn, async (req, res) => {
  if (!req.user.is_member) {
    return res.status(403).send("Only members can create messages.");
  }

  const { title, text } = req.body;

  try {
    await prisma.message.create({
      data: {
        title,
        content: text,
        author_id: req.user.id,
      },
    });
    req.flash("successMessage", "Message created successfully!");
    res.redirect("/messages");
  } catch (error) {
    console.error("Error creating message:", error);
    res.render("create-message", {
      title: "Create Message",
      user: req.user,
      error: "Failed to create message. Please try again.",
    });
  }
});

app.get("/create-message", ensureLoggedIn, (req, res) => {
  if (!req.user.is_member) {
    return res.render("become-member", {
      title: "Become a Member",
      error: "You need to become a member first to create messages.",
      user: req.user,
    });
  }
  res.render("create-message", {
    title: "Create Message",
    user: req.user,
    error: null,
  });
});

app.get("/get-the-code", (req, res) => {
  res.render("get-the-code", {
    title: "Get the Code",
    user: req.user,
    memberCode: process.env.MEMBER_SECRET_CODE,
  });
});

app.post("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/", (req, res) => {
  res.render("index", { title: "Home", user: req.user });
});
app.get("/register", (req, res) => {
  res.render("register", {
    title: "Register",
    user: req.user,
    error: req.flash("error") || [],
    formData: req.flash("formData")[0],
  });
});
app.get("/login", (req, res) => {
  const successMessage = req.flash("success");
  res.render("login", {
    title: "Login",
    successMessage,
    user: req.user,
    error: req.flash("error"),
  });
});

// Self-pinging route to keep the server alive
app.get("/self-ping", (req, res) => {
  res.status(200).send("Pinged self.");
});

const PORT = 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start self-pinging only in production
  if (process.env.NODE_ENV === "production") {
    setInterval(() => {
      fetch(`${APP_URL}/self-ping`)
        .then((res) => {
          if (res.ok) {
            console.log("Self-ping successful.");
          } else {
            console.error("Self-ping failed:", res.statusText);
          }
        })
        .catch((err) => console.error("Error during self-ping:", err));
    }, 1 * 60 * 1000); // 13 minutes
  }
});
