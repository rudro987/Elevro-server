const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const dbAdmin = process.env.ELEVRO_USER;
const dbPassWord = process.env.ELEVRO_PASSWORD;

const uri = `mongodb+srv://${dbAdmin}:${dbPassWord}@cluster0.bndsovl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("elevroDB");
    const usersCollection = db.collection("users");
    const allTestsCollection = db.collection("allTests");
    const bookedTestsCollection = db.collection("bookedTests");

    //jwt api
    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
        res.send({ token });
    });


    //all users related api

    app.get('/allTests', async (req, res) => {
      const result = await allTestsCollection.find().toArray();
      res.send(result);
    });

    app.get('/allTests/:id', async (req, res) => {
      const id = req.params.id;    
      const query = { _id: new ObjectId(id) };
      const result = await allTestsCollection.findOne(query);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/bookedTest', async (req, res) => {
      const bookedTest = req.body;
      const result = await bookedTestsCollection.insertOne(bookedTest);
      res.send(result);
    });
    
    app.patch('/allTests/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $inc: {
          bookings: 1,
          slots: -1
        }
      }
      const result = await allTestsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Admin related apis

    // await client.connect();

    // Connect the client to the server	(optional starting in v4.7)
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Elevro server running successfully!");
});

app.listen(port, () => {
  console.log(`Elevro server running on port ${port}`);
});
