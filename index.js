const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
// Custom middleware
app.use(
  cors({
    origin: [process.env.LOCAL_SERVER],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// const logger = async (req, res, next) => {
//   console.log("Log", req.host, req.originalUrl);
//  next();
// };

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unathorized" });
  }
  jwt.verify(token, process.env.AUTHORIZATION_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unathorized" });
    }
    req.user = decoded;
    next();
  });
};

require("dotenv").config();

// Mongodb config
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.ILK_LODGE_USER}:${process.env.ILK_LODGE_PASS}@cluster0.pzharqa.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // database
    const database = client.db("Ilk_Lodge");
    const homePageReviewCollection = database.collection("HomePageReview");
    const roomsCollection = database.collection("rooms");
    const bookedRoomsCollection = database.collection("bookedRooms");
    const userReviewCollection = database.collection("userReview");
    const newsCollection = database.collection("news");

    // jwt token generation
    app.post("/jwt", async (req, res) => {
      const payload = req.body;
      const token = jwt.sign(payload, process.env.AUTHORIZATION_TOKEN, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Removing cookie when user logged out
    app.post("/clearuserjwttoken", async (req, res) => {
      // here we getting user information that which user is logged in and out.
      const user = req.user;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Home page hotel testimonials
    app.get("/testimonial", async (req, res) => {
      const testimonialData = await homePageReviewCollection.find().toArray();
      res.send(testimonialData);
    });

    // Get single room data for single room detail page
    app.get("/rooms/singleRoomDetails/:id", async (req, res) => {
      const currentRoomId = req.params.id;
      const query = { _id: new ObjectId(currentRoomId) };
      const resut = await roomsCollection.findOne(query);
      const reviewId = { id: currentRoomId };
      const reviews = await userReviewCollection.find(reviewId).toArray();
      res.send({ roomData: resut, reviews: reviews });
    });

    // Fetching room data
    app.get("/rooms", async (req, res) => {
      const sortData = req.query.sortRooms;
      AvailableQuery = { available: true };
      const options = {
        projection: { _id: 1, photo: 1, price: 1, reviewCount: 1 },
      };
      if (sortData === "high") {
        const result = await roomsCollection
          .find({}, options)
          .sort({ price: -1 })
          .toArray();
        res.send(result);
      } else if (sortData === "low") {
        const result = await roomsCollection
          .find({}, options)
          .sort({ price: 1 })
          .toArray();
        res.send(result);
      } else if (sortData === "availableroom") {
        const result = await roomsCollection.find(AvailableQuery).toArray();
        res.send(result);
      } else {
        const result = await roomsCollection.find().toArray();
        res.send(result);
      }
    });

    app.get("/promotions", async (req, res) => {
      AvailableQuery = { available: true, price: { $lt: 48 } };
      const options = {
        projection: { _id: 1, photo: 1, price: 1, type: 1 },
      };

      const result = await roomsCollection
        .find(AvailableQuery, options)
        .toArray();
      res.send(result);
    });

    app.get("/news", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });

    // Fetching data for featured rooms
    app.get("/featuredProduct", async (req, res) => {
      const query = { featured: true };
     
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });

    // User booked rooms data for mybooking page
    app.post("/mybookings", verifyToken, async (req, res) => {
      console.log("User token", req.user);
      if (req.user.email === req.body.userEmail) {
        const currentUserEmail = req.body.userEmail;
        console.log(currentUserEmail);

        const query = { userEmail: currentUserEmail };
        const options = {
          projection: { currentRoomData: 1, _id: 1 },
        };
        const currentUserBookings = await bookedRoomsCollection
          .find(query, options)
          .toArray();
        res.send(currentUserBookings);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // add rooms from add room page
    app.post("/addroom", verifyToken, async (req, res) => {
      console.log(req.query);
      if (req.user.email === req.query.userEmail) {
        const currentRoomData = req.body;
        console.log(currentRoomData);
        const result = await roomsCollection.insertOne(currentRoomData);
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // adding review text for review field
    app.patch("/addreview", verifyToken, async (req, res) => {
      if (req.user.email === req.query.userEmail) {
        const userReview = req.body;
        const roomUpdateId = { _id: new ObjectId(userReview.id) };
        const roomDataFromRoomCollection = await roomsCollection.findOne(
          roomUpdateId
        );
        const updateCount = roomDataFromRoomCollection.reviewCount;
        const currentReviewCount = updateCount + 1;
        const updateDoc = {
          $set: {
            reviewCount: currentReviewCount,
          },
        };
        const reviewCountUpdate = await roomsCollection.updateOne(
          roomUpdateId,
          updateDoc
        );
        const result = await userReviewCollection.insertOne(userReview);
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    app.patch(
      "/rooms/singleRoomDetails/bookRoom",
      verifyToken,
      async (req, res) => {
        if (req.user.email === req.query.user) {
          const userEmail = req.query.user;
          const currentRoomData = req.body.bookingData;

          // Updating availablity state
          const userBookedRoomId = currentRoomData.roomId;
          const bookedDate = currentRoomData.date;
          console.log(bookedDate);
          const query = { _id: new ObjectId(userBookedRoomId) };

          const updateDoc = {
            $set: {
              available: false,
              lastbookDate: bookedDate,
            },
          };
          const roomDataFromRoomCollection = await roomsCollection.updateOne(
            query,
            updateDoc
          );
          // Inset booked data on bookedRooms collection
          const data = { userEmail, currentRoomData };
          const result = await bookedRoomsCollection.insertOne(data);
          res.send(result);
        } else {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
    );

    // booked room update date
    app.patch("/updateBookedDate", verifyToken, async (req, res) => {
      if (req.user.email === req.query.userEmail) {
        const { newDate, bookedId, roomId } = req.query;
        const roomDataQuery = { _id: new ObjectId(roomId) };
        const roomDataUpdate = {
          $set: {
            lastbookDate: newDate,
          },
        };
        const bookedRoomData = await roomsCollection.updateOne(
          roomDataQuery,
          roomDataUpdate
        );

        const bookedRecordQuery = { _id: new ObjectId(bookedId) };
        const bookedRoomDataUpdate = {
          $set: {
            "currentRoomData.date": newDate,
          },
        };
        const bookedRecordData = await bookedRoomsCollection.updateOne(
          bookedRecordQuery,
          bookedRoomDataUpdate
        );
        res.send(bookedRecordData);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // Booked Room Delete api

    app.delete("/deletebookedroom", verifyToken, async (req, res) => {
      if (req.user.email === req.query.userEmail) {
        const currentDeletionDataId = req.query.id;
        const roomDetailId = req.query.roomId;
        const query = { _id: new ObjectId(roomDetailId) };
        const updateDoc = {
          $set: {
            available: true,
            lastbookDate: "",
          },
        };
        const roomDataFromRoomCollection = await roomsCollection.updateOne(
          query,
          updateDoc
        );
        console.log(roomDataFromRoomCollection);
        const deleteQuery = { _id: new ObjectId(currentDeletionDataId) };
        const result = await bookedRoomsCollection.deleteOne(deleteQuery);
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Server config
app.get("/", (req, res) => {
  res.send("Server is running!");
});
app.listen(port, () => {
  console.log("Server is running on port", port);
});
