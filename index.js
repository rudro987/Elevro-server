const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PG_SECRET_KEY);
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

const dbConnect = async () => {
  try {
    client.connect();
    console.log('DB connected successfully');
  } catch (error) {
    console.log(error.message);
  }
}
dbConnect();

    const db = client.db("elevroDB");
    const usersCollection = db.collection("users");
    const allTestsCollection = db.collection("allTests");
    const bookedTestsCollection = db.collection("bookedTests");
    const bannerCollection = db.collection("banners");
    const blogsCollection = db.collection("blogs");

    app.get("/", (req, res) => {
      res.send("Elevro server running successfully!");
    });

    //jwt api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //all users related api

    app.get("/allTests", async (req, res) => {
      const result = await allTestsCollection.find().toArray();
      res.send(result);
    });

    app.get("/allTests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allTestsCollection.findOne(query);
      res.send(result);
    });

    app.get("/allTestsData", async (req, res) => {
      const currentDate = new Date();
      const allTests = await allTestsCollection.find().toArray();
      const filteredTests = allTests.filter((test) => {
        const testDate = new Date(test.date);
        return testDate >= currentDate;
      });
      res.send(filteredTests);
    });

    app.get("/userBookings", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await bookedTestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/loggedUser/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const result = await usersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    app.get("/bookedTest/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await bookedTestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/banners/status", async (req, res) => {
      const query = { active: true };
      const result = await bannerCollection.findOne(query);
      res.send(result);
    });

    app.get("/allBlogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.get("/alloBlogs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    app.get("/bookedTests/result", verifyToken, async (req, res) => {
      const email = req.decoded.email;
      const query = { email: email, report_status: "delivered" };
      const result = await bookedTestsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookedTest", verifyToken, async (req, res) => {
      const bookedTest = req.body;
      const result = await bookedTestsCollection.insertOne(bookedTest);
      res.send(result);
    });

    app.patch("/allTests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $inc: {
          bookings: 1,
          slots: -1,
        },
      };
      const result = await allTestsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/allTests/userUpdate/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $inc: {
          bookings: -1,
          slots: 1,
        },
      };
      const result = await allTestsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

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

    app.patch("/users/profile/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const userInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: userInfo,
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/userBookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { test_id: id };
      const result = await bookedTestsCollection.deleteOne(query);
      res.send(result);
    });

    //payment

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Admin related apis

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const user = await usersCollection.findOne(query);
      let userStatus = false;
      if (user) {
        userStatus = user?.status === "active";
      }
      res.send({ userStatus });
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/allBookings", verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      let query = {};
      if (search) {
        query = { email: search };
      }
      if (search === "") {
        const result = await bookedTestsCollection.find().toArray();
        res.send(result);
      } else {
        const result = await bookedTestsCollection.find(query).toArray();
        res.send(result);
      }
    });

    app.get("/banners", verifyToken, verifyAdmin, async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result);
    });

    app.get("/blogs", verifyToken, verifyAdmin, async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    app.post("/addTest", verifyToken, verifyAdmin, async (req, res) => {
      const test = req.body;
      const result = await allTestsCollection.insertOne(test);
      res.send(result);
    });

    app.post("/addBanner", verifyToken, verifyAdmin, async (req, res) => {
      const banner = req.body;
      const result = await bannerCollection.insertOne(banner);
      res.send(result);
    });

    app.post("/addBlog", verifyToken, verifyAdmin, async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    app.put("/allTests/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedTest = req.body;
      const updatedDoc = {
        $set: updatedTest,
      };
      const result = await allTestsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch(
      "/allTests/adminUpdate/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $inc: {
            bookings: -1,
            slots: 1,
          },
        };
        const result = await allTestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = req.query.role;
        const filter = { _id: new ObjectId(id) };
        let updatedDoc = {};
        if (query === "admin") {
          updatedDoc = {
            $set: {
              role: "user",
            },
          };
        } else if (query === "user") {
          updatedDoc = {
            $set: {
              role: "admin",
            },
          };
        }
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const query = req.query.status;
      let updatedDoc = {};
      if (query === "active") {
        updatedDoc = {
          $set: {
            status: "blocked",
          },
        };
      } else if (query === "blocked") {
        updatedDoc = {
          $set: {
            status: "active",
          },
        };
      }

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch(
      "/allBookings/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const report = req.body;
        const updatedDoc = {
          $set: report,
        };
        const result = await bookedTestsCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    );

    app.patch("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedStatus = req.body;
      const updatedDoc = {
        $set: updatedStatus,
      };
      const result = await bannerCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/allTests/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allTestsCollection.deleteOne(query);
      res.send(result);
    });

    app.delete(
      "/allBookings/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { test_id: id };
        const result = await bookedTestsCollection.deleteOne(query);
        res.send(result);
      }
    );

    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.deleteOne(query);
      res.send(result);
    });

app.listen(port, () => {
  console.log(`Elevro server running on port ${port}`);
});
