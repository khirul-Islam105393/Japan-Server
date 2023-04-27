const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
//Japan-warehouse
//E7Md9S08LBh43NPY

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.midyoic.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log(req.headers);
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("Japan-warehouse").collection("Parts");
    const bookingCollection = client
      .db("Japan-warehouse")
      .collection("booking");
    const usersCollection = client.db("Japan-warehouse").collection("users");
    const orderInfoCollection = client
      .db("Japan-warehouse")
      .collection("orderInfo");

    //get all users
    app.get("/user", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });


    app.get('/isAdmin', async(req, res)=>{
      const loggedUser = req.query.loggedUser;
      const query = {email:loggedUser};
      const result = await usersCollection.find(query).toArray();
        res.send(result)
      
    })
    app.get('/myOrder', async(req, res)=>{
      const loggedUser = req.query.loggedUser;
      const query = {email:loggedUser};
      const result = await orderInfoCollection.find(query).toArray();
        res.send(result)
      
    })

    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.totalPrice;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //if the user does not exist in the collection, create a new user .
    //if the user exists, update it

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;

      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(filter, updateDoc, option);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });




   

    app.put("/users/admin/:id",  async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      console.log(filter, "filter");
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //get all parts
    app.get("/parts", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
    });

    //keep parts
    app.post("/parts", async (req, res) => {
      const newProduct = req.body;
      const result = await partsCollection.insertOne(newProduct);

      res.send({ success: true, result });
    });
    
//Post for orderCollection
    app.post("/orderInfo", async (req, res) => {
      const orderInfo = req.body;
      const result = await orderInfoCollection.insertOne(orderInfo);

      res.send({ success: true, result });
    });

    // Get Api for Ordered List
    app.get("/orderInfo", async (req, res) => {
      const query = {};
      const cursor = orderInfoCollection.find(query);
      const orderedList = await cursor.toArray();
      res.send(orderedList);
    });


    //update API for OrderInfoCollection
    app.patch('/updatedStatus/:id',async(req, res)=>{
      const id = req.params.id;
      const newStatus = req.body.status;
      const filter = {_id: new ObjectId(id)};
      const option = {upsert:true};
      const updateDoc ={
        $set:{status:newStatus}
      };

      const result = await orderInfoCollection.updateOne(filter,updateDoc,option);

      let finalRes
      if(result.modifiedCount){
        const query= {};
        const cursor = orderInfoCollection.find(query);
        const updatedResult = await cursor.toArray();
        finalRes = {data:updatedResult, success:true, message:'Data Successfully Updated'}
      }
      else{
        finalRes = {data:[], success:false, message:'Something Went wrong'}
      }
   res.send({result: finalRes})
    })



    // app.patch("/updateOrder/:id", async (req, res) => {

    //   const id = req.params.id
    //   const newCondition = req.body.status;
    
      
    //   const filter = { _id: new ObjectId(id) };
    //   const option = { upsert: true };
    //   const updateDoc = {
    //     $set: { status: newCondition },
    //   };

    //   const result = await orderInfoCollection.updateOne(
    //     filter,
    //     updateDoc,
    //     option
    //   );
    //   let finalRes;
    //   if (result.modifiedCount) {
    //     const cursor = orderInfoCollection.find({});
    //     const newOrders = await cursor.toArray();
    //     finalRes ={data:newOrders,success:true,message:'Data get updated successfully'};
    //   } else {
    //     finalRes ={data:[],success:false,message:'Something went wrong'};
        
    //   }
    //   res.send({ result: finalRes });
    // });

    //Delete a user
    app.delete("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      if (result.deletedCount) {
        const cursor = partsCollection.find({});
        const parts = await cursor.toArray();
        const result = {
          data: parts,
          success: true,
          message: "Items successfully deleted",
        };
        res.send(result);
      } else {
        const result = {
          data: [],
          success: false,
          message: "Something went wrong",
        };
        res.send(result);
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Japan-warehouse");
});

app.listen(port, () => {
  console.log(`Japan-warehouse app listening on port ${port}`);
});
