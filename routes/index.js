const express = require("express");
const app = express();

//route for brand analysis section
const brandrouter=require("./brandSection")
app.use("/brand",brandrouter)

//route for competitor analysis section
const Competiorrouter=require("./competitorAnalysis")
app.use("/comp",Competiorrouter)

//route for search section 
const searchrouter=require("./search")
app.use("/search",searchrouter)

module.exports=app