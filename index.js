import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import {Strategy} from  'passport-local';

const app = express();
const port = 3000;
const saltRounds = 15;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "FrugalFundsMonitor",
  password: "pencil",
  port: 5432,
});
db.connect();

let transactions_demo = [{
  "name" : "Bank Interest",
  "type" : "income",
  "amount" : 1000,
  "date" : "07/01/2024",
  "category" : "income"
},
{
  "name" : "Rent",
  "type" : "expense",
  "amount" : 3000,
  "date" : "07/01/2024",
  "category" : "housing"
},
{
  "name" : "Chicken Biryani",
  "type" : "expense",
  "amount" : 300,
  "date" : "07/01/2024",
  "category" : "Food"
},
{
  "name" : "Salary",
  "type" : "income",
  "amount" : 15000,
  "date" : "07/01/2024",
  "category" : "income"
},
{
  "name" : "Groceries",
  "type" : "expense",
  "amount" : 1000,
  "date" : "07/01/2024",
  "category" : "Groceries"
},
{
  "name" : "Auto fare",
  "type" : "expense",
  "amount" : 500,
  "date" : "07/01/2024",
  "category" : "Transport"
}];

const categories_demo = [{
  "name" : "Food",
  "limit" : 1000
},
{
  "name" : "Shopping",
  "limit" : 2000
},
{
  "name" : "Transport",
  "limit" : 800
},
{
  "name" : "Income",
  "limit" : "-"
},
{
  "name" : "Others",
  "limit" : "-"
}];



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "topsecret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}))

// after session use passport
app.use(passport.initialize());
app.use(passport.session());


// functions
//retuens array of transactions of the specified username
async function getTransactions(username){
  const result = await db.query("SELECT transaction_name AS name, transaction_type AS type, transaction_amount AS amount, TO_CHAR(transaction_date, 'DD-MM-YYYY') AS date, category_name AS category FROM (SELECT transactions.transaction_name, transactions.transaction_type, transactions.transaction_amount, transactions.transaction_date, transactions.username, categories.category_name FROM transactions JOIN categories ON transactions.category_id = categories.category_id) AS records WHERE records.username =$1 ORDER BY date DESC;",[username]);
  return result.rows;  
}

// returns the an oject containing username, balance, expense of the specified username
async function getBalAndExp(username){
  const income = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='income';",[username]);
  let userIncome = income.rows[0].sum;
  const expense = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='expense';",[username]);
  let userExpense = expense.rows[0].sum;
  let result = {
    "username" : username,
    "balance": userIncome - userExpense,
    "expense": userExpense
  };
  return result;
}

//returns a list of category objects of the specified username
async function getCategories(username){
  const result = await db.query("SELECT category_id AS id, category_name AS name, category_limit AS limit FROM categories WHERE categories.username =$1 ORDER BY name;",[username]);
  return result.rows;
}

async function getCategoryId(categoryName, username){
  const result = await db.query("SELECT category_id FROM categories WHERE category_name=$1 and username=$2;",[
    categoryName,
    username
  ]);
  return result.rows[0];
}

//returns the current month transactions array and previous transactions array in an array
async function getCurrentAndPreviousTransactions(username){
  let currentMonthTransactions = [];
  let previousTransactions = [];
  let result = [];
  const allTransactions = await getTransactions(username);
  const present = new Date();
  let currentMonth = present.getMonth() + 1;
  let currentYear = present.getFullYear();
  for(let i = 0; i < allTransactions.length; i++){
    let transaction = allTransactions[i];
    let transactionMonth = parseInt(transaction.date.split('-')[1]);
    let transactionYear = parseInt(transaction.date.split('-')[2]);
    if(transactionMonth === currentMonth && transactionYear === currentYear){
      currentMonthTransactions.push(transaction);
    }else{
      previousTransactions.push(transaction);
    }
  }
  result.push(currentMonthTransactions);
  result.push(previousTransactions);
  return result;
}

// async function deleteCategory(categoryId){
//   const result = await db.query("SELECT category_name FROM categories WHERE category_id = $1",[categoryId]); 
// }

// GET to /home - render the home page with recent 5 transactions, categories list, balance, expenses
app.get("/home",async (req,res)=>{
  console.log("at /home",req.user);
  const user = req.user;
  if(req.isAuthenticated()){
    let transactions = [];
    let categories = []
    try{
      const userDetails = await getBalAndExp(user.username);
      transactions = await getTransactions(user.username);
      if(transactions.length >= 5){
        transactions = transactions.slice(0,5);
      }
      try{
        categories = await getCategories(user.username);
        console.log(categories);
      }catch(err){
        console.log("Error getting categories", err);
        res.render("index.ejs",{
          "name_of_user" : user.name_,
          "user_details" : userDetails,
          "recent_transactions" : transactions
        });
      }
      res.render("index.ejs",{
        "name_of_user" : user.name_,
        "user_details" : userDetails,
        "recent_transactions" : transactions,
        "categories" : categories
      });
    }catch(err){
      console.log("Error getting transactions ",err);
      res.render("index.ejs",{
        "name_of_user" : user.name_
      });
    }
  }else{
    res.redirect("/login");
  }
});

app.get("/history",async (req,res)=>{
  if(req.isAuthenticated()){
    let currentMonthTransactions = [];
    let previousTransactions = [];
    try{
      const result = await getCurrentAndPreviousTransactions(req.user.username);
      currentMonthTransactions = result[0];
      previousTransactions = result[1];
      res.render("history.ejs",{
        "current_month_transactions" : currentMonthTransactions,
        "previous_transactions" : previousTransactions
      });
    }catch(err){
      console.log(err);
      res.render("history.ejs");
    }
  }else{
    res.redirect("/login");
  }
});

app.get("/category",async (req,res)=>{
  if(req.isAuthenticated()){
    let categories = [];
    try{ 
      categories = await getCategories(req.user.username);
      res.render("category.ejs",{
        "categories" : categories
      });      
    }
    catch(err){
     console.log("Error getting categories", err);
     res.render("category.ejs",{
      "error" : "Catrgories could not be loaded at the moment. Please refresh. If this error persists please contact support."
     });
    }
  }else{
    res.redirect("/login");
  }
});

app.get("/settings",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("settings.ejs");
  }else{
    res.redirect("/login");
  }
});
app.get("/reports",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("reports.ejs");
  }else{
    res.redirect("/login");
  }
});
app.get("/login",(req,res)=>{
  res.render("login.ejs");
});
app.get("/",(req,res) => {
  res.redirect("/login");
})
app.get("/signup",(req,res)=>{
  res.render("signup.ejs");
});

app.post("/signup",async (req,res) => {
    const name = req.body.name;
    const username = req.body.username;
    const password = req.body.password;
    console.log(req.body);
    try {
      const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [
        username,
      ]);  
      if (checkResult.rows.length > 0) {
        res.send("Email already exists. Try logging in.");
      } else {
        //hashing the password and saving it in the database
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            console.log("Hashed Password:", hash);
            const result = await db.query(
              "INSERT INTO users (name_, username, userpassword) VALUES ($1, $2, $3) RETURNING *",
              [name, username, hash]
            );
            const user = result.rows[0];
            await db.query("INSERT INTO categories (category_name,username) VALUES ('Others',$1);",[
              username
            ]);
            req.login(user,(err) => {
              console.log("after const user: ",err);
              res.redirect("/home");
            });
          }
        });
      }
    } catch (err) {
      console.log(err);
      res.render("/signup");
    }
});

app.post("/login",  passport.authenticate("local",{
  successRedirect:"/home",
  failureRedirect:"/login"
}));

app.post("/home", async (req, res) => {
  if(req.isAuthenticated()){
    try{
      const transaction = req.body;
      const username = req.user.username;
      const category = await getCategoryId(transaction.category,username);
      const categoryId =  category.category_id;
      const result = await db.query(
        "INSERT INTO transactions (transaction_name, transaction_type, transaction_amount, transaction_date, username, category_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;",[
        transaction.expenditure,
        transaction.type,
        parseFloat(transaction.amount),
        transaction.date,
        username,
        categoryId
      ]);
      console.log(result.rows);
      res.redirect("/home");
    }catch(err){
      console.log(err);
      res.redirect("/home")
    }
  }else{
    res.redirect( "/login" );
  }
});

app.post("/add-category", async (req,res) =>{
  if(req.isAuthenticated()){
    let username = req.user.username;
    console.log(req.body);
    console.log(typeof(req.body.limit));
    const result =  await getCategories(username);
    let allCategories = [];
    result.forEach((item) => {
      allCategories.push(item.name);
    })
    if(!allCategories.includes(req.body.category)){
      let categoryName = req.body.category;
      let categoryLimit = (req.body.limit === "") ? null : parseFloat(req.body.limit);
      await db.query("INSERT INTO categories(category_name, username, category_limit) VALUES($1, $2, $3);",[
        categoryName,
        username,
        categoryLimit
      ]);
      res.redirect("/category");
    }else{
      res.redirect("/home");
    }
  }else{
    res.redirect("/login");
  }
});

app.post("/edit-category", (req,res) => {
  if(req.isAuthenticated()){
    console.log(req.body);
    res.redirect("/category");
  }else{
    res.redirect("/login");
  }
});

app.post("/delete-category", async (req,res) =>{
  if(req.isAuthenticated()){
    let categoryId = req.body.id;
    try{
      await db.query("DELETE FROM categories WHERE category_id=$1", [categoryId]);
      res.redirect("/category");
    }catch(err){
      console.log(err)
      res.redirect("/home");
    }
  }else{
    res.redirect("/login");
  }
})

passport.use(new Strategy(async function verify(username, password, cb){
  console.log("In strategy");
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(username);
      console.log(password);
      console.log(user);
      const storedHashedPassword = user.userpassword;
      bcrypt.compare(password, storedHashedPassword, (err, result) => {
        if (err) {
          return cb(err);
        } else {
          if (result) {
            return cb(null, user);
          } else {
            return  cb(null, false);
          }
        }
      });
    } else {
      return cb("User not found.");
    }
  } catch (err) {
    return cb(err);
  }
}))

passport.serializeUser((user,cb) =>{
  cb(null,user);
})
passport.deserializeUser((user,cb) =>{
  cb(null,user);
})

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});