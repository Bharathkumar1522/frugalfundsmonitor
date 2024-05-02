import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import {Strategy} from  "passport-local";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();
const saltRounds = process.env.SALT_ROUNDS;

const db = new pg.Client({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD, //password
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// after session use passport
app.use(passport.initialize());
app.use(passport.session());

// functions
//returns array of transactions of the specified username
async function getTransactions(username){
  const result = await db.query("SELECT transaction_name AS name, transaction_type AS type, transaction_amount AS amount, TO_CHAR(transaction_date, 'DD-MM-YYYY') AS date, category_name AS category FROM (SELECT transactions.transaction_name, transactions.transaction_type, transactions.transaction_amount, transactions.transaction_date, transactions.username, categories.category_name FROM transactions JOIN categories ON transactions.category_id = categories.category_id ORDER BY transaction_date DESC) AS records WHERE records.username =$1 ;",[username]);
  return result.rows;  
}
// returns the an oject containing username, balance, expense of the specified username
async function getBalAndExp(username){
  const income = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='income';",[username]);
  let userIncome = income.rows[0].sum;
  const expense = await db.query("SELECT SUM(transaction_amount) FROM transactions WHERE username =$1 AND transaction_type='expense' AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE);",[username]);
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
//gets the category of the specified category name and user
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
// gets category wise expenses for the current month as data for pie chart
async function getPieChartData(username){
  const result = await db.query("SELECT C.category_name AS category, SUM(T.transaction_amount) AS total_expense FROM transactions T JOIN categories C ON T.category_id = C.category_id WHERE T.username=$1 AND DATE_TRUNC('month', T.transaction_date) = DATE_TRUNC('month', CURRENT_DATE) AND T.transaction_type='expense' GROUP BY C.category_name;",[
    username
  ]);
  // if(result.rows.length > 0){
    return result.rows;
  // }else{
  //   return -1;
  // }
}
// check is the  total expenses of a certain category is under the limit or not
async function isAmountUnderLimit(username, categoryId){
  const result1= await db.query("SELECT category_limit FROM categories WHERE category_id = $1",[
    categoryId
  ]);
  let categoryLimit = result1.rows[0].category_limit;
  if(categoryLimit != null){
    const result2 = await db.query("SELECT C.category_name AS category, SUM(T.transaction_amount) AS total_expense FROM transactions T JOIN categories C ON T.category_id = C.category_id WHERE T.username=$1 AND DATE_TRUNC('month', T.transaction_date) = DATE_TRUNC('month', CURRENT_DATE) AND T.transaction_type='expense' AND T.category_id=$2 GROUP BY C.category_name;",[
      username,
      parseInt(categoryId)
    ]);
    let categoryExpenses = result2.rows[0].total_expense;
    if(parseInt(categoryExpenses) > parseInt(categoryLimit)){
      return false;
    }else{
      return true;
    }
  }else{
    return true;
  }
}

//user GET routes
app.get("/",(req,res) => {
  res.redirect("/login");
})
app.get("/home",async (req,res)=>{
  if(req.isAuthenticated()){
    const user = req.user;
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
app.get("/account",(req,res)=>{
  if(req.isAuthenticated()){
    res.render("account.ejs",{
      "user": req.user
    });
  }else{
    res.redirect("/login");
  }
});
app.get("/reports",async (req,res)=>{
  if(req.isAuthenticated()){
    try{
      const pieData = await getPieChartData(req.user.username);
      console.log(JSON.stringify(pieData));
      if(pieData != -1){
        res.render("reports.ejs",{
          pieData: JSON.stringify(pieData),
          categoryData: pieData
        });
      }else{
        res.render("reports.ejs",{
          "message": "No transactions have been made in current month to generate reports."
        })
      }
    }catch(err){
      console.log("Error getting data for plots",err);
      res.render("reports.ejs",{
        "errorMessage": "There was an error generating report, try again later."
      })
    }
  }else{
    res.redirect("/login");
  }
});

// user authenticatin routes
app.get("/login",(req,res)=>{
  res.render("login.ejs");
});
app.get("/signup",(req,res)=>{
  res.render("signup.ejs");
});
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/'); 
  });
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

// user POST routes
app.post("/home", async (req, res) => {
  if(req.isAuthenticated()){
    try{
      const user = req.user;
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
      const isUnderLimit = await isAmountUnderLimit(username, categoryId);
      let transactions = [];
      let categories = [];
      if(isUnderLimit === false){
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
              "recent_transactions" : transactions,
              "showReminder" : true,
              "categoryExceeded" : transaction.category
            });
          }
          res.render("index.ejs",{
            "name_of_user" : user.name_,
            "user_details" : userDetails,
            "recent_transactions" : transactions,
            "categories" : categories,
            "showReminder" : true,
            "categoryExceeded" : transaction.category
          });
        }catch(err){
          console.log("Error getting transactions ",err);
          res.render("index.ejs",{
            "name_of_user" : user.name_,
            "showReminder" : true,
            "categoryExceeded" : transaction.category
          });
        }
      }else{
        res.redirect("/home");
      }
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
      console.log("Can not delete category.") 
      res.redirect("/home");
    }
  }else{
    res.redirect("/login");
  }
})

// passport strategy for user authentication
passport.use(new Strategy(async function verify(username, password, cb){
  console.log("In strategy");
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
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
}));
passport.serializeUser((user,cb) =>{
  cb(null,user);
});
passport.deserializeUser((user,cb) =>{
  cb(null,user);
});

app.listen(port, () => {
  console.log(`API is running at http://localhost:${port}`);
});