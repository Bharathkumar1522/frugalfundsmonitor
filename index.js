import express from "express";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });

app.get("/home",(req,res)=>{
    res.render("index.ejs");
});
app.get("/history",(req,res)=>{
  res.render("history.ejs");
});
app.get("/category",(req,res)=>{
  res.render("category.ejs");
});
app.get("/settings",(req,res)=>{
  res.render("settings.ejs");
});
app.get("/reports",(req,res)=>{
  res.render("reports.ejs");
});
app.get("/",(req,res)=>{
  res.render("login.ejs");
});
app.get("/signup",(req,res)=>{
  res.render("signup.ejs");
});


