const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
var jwt = require('jsonwebtoken');

app.use(cors({origin:["http://localhost:5173"],credentials:true}));
app.use(express.json());

require('dotenv').config();

// Mongodb config
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.ILK_LODGE_USER}:${process.env.ILK_LODGE_PASS}@cluster0.pzharqa.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    // database
    const database = client.db("Ilk_Lodge");
    const homePageReviewCollection = database.collection("HomePageReview");

    // Home page hotel testimonials
    app.get("/testimonial",async(req,res)=>{
      const testimonialData = await homePageReviewCollection.find().toArray();
      res.send(testimonialData)
    })

    // jwt token generation
    app.post("/jwt",async(req,res)=>{
      const payload = req.body;
      const token = jwt.sign(payload,process.env.AUTHORIZATION_TOKEN,{expiresIn:"1h"});
      res.cookie("token",token).send({"success" : true})
    })

    // > Cookie is okey.
    
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



// Server config
app.get("/",(req,res)=>{
    res.send("Server is running!");
})
app.listen(port,()=>{
    console.log("Server is running on port",port);
})