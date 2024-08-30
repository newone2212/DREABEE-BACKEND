const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 8081;
const host = "0.0.0.0";
const path = require("path");
require("./db/conn");
require("./db/onn2");
const bodyparser = require("body-parser");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: false }));
// Routes
const router=require("./routes/index")
app.use("/api",router)


app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
