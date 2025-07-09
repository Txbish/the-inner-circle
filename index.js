require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const passport = require("passport");
const session = require("express-session");

const app = express();

let indexRouter = require("./routes/index");
let authRouter = require("./routes/auth");
app.locals.pluralize = require("pluralize");

console.log("🚀 Starting Express application...");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.listen(3000, () => {
  console.log("Server Started on Port 3000");
});
