// Helps us connect to database
const { ObjectId } = require("bson");
const dbo = require("../connection");

exports.getAllVenues = (req, res) => {
  const dbConnect = dbo.getDb();

  dbConnect
    // Specify the collection(table) we want data from
    .collection("Venues")
    // GET all the data from the collection
    .find({})
    // Changes retrieved data from request to an array for response
    .toArray((err, result) => {
      res.json(result);
    });
};

exports.getVenue = (req, res) => {
  const dbConnect = dbo.getDb();

  const id = req.params.venue_id;

  dbConnect
    // Specify the collection(table) we want data from
    .collection("Venues")
    // GET specific data from the collection
    .findOne({ _id: ObjectId(id) })
    .then(result => {
      res.status(200).send(result);
    });
};

exports.postNewVenue = async (req, res) => {
  const dbConnect = dbo.getDb();
  const newObj = req.body;
  const expectedKeys = [
    "venue_name",
    "coordinates",
    "description",
    "picture",
    "address",
    "upcoming_events"
  ];

  for (let i = 0; i < expectedKeys.length; i++) {
    if (!Object.keys(newObj).includes(expectedKeys[i])) {
      return res.status(400).send({
        status: 400,
        message: "Invalid Data Key"
      });
    }
  }

  await dbConnect
    .collection("Venues")
    .insertOne(newObj, function(err, result) {
      if (err) {
        res.status(400).send("Error inserting matches!");
      } else {
        console.log(`Added a new match with id ${result.insertedId}`);
        res.status(201).send(newObj);
      }
    });
};

exports.patchVenue = async (req, res) => {
  const dbConnect = dbo.getDb();

  const updateObject = req.body;
  const id = req.params.venue_id;

  let venue;

  await dbConnect
    .collection("Venues")
    .findOne({ _id: ObjectId(id) })
    .then(result => {
      venue = result;
    });
  if (updateObject.hasOwnProperty("add_event")) {
    for (let i = 0; i < venue.upcoming_events.length; i++) {
      if (
        venue.upcoming_events[i].event_id ===
        updateObject.add_event.event_id
      ) {
        return res.status(400).send("event already in there");
      }
    }
    return await dbConnect.collection("Venues").updateOne({
      _id: ObjectId(id)
    }, {
      $push: {
        upcoming_events: updateObject.add_event
      }
    }, function(err, _result) {
      if (err) {
        return res.status(400).send(`Error updating events on user`);
      } else {
        console.log("Event added to venue");
        return res.status(200).send(updateObject.add_event);
      }
    });
  }

  if (updateObject.hasOwnProperty("remove_event")) {
    return await dbConnect.collection("Venues").findOneAndUpdate({
      _id: ObjectId(id)
    }, {
      $pull: {
        upcoming_events: updateObject.remove_event
      }
    }, function(err, _result) {
      if (err) {
        return res.status(400).send("Error removing event");
      } else {
        return res.status(200).send();
      }
    });
  }

  if (
    !updateObject.hasOwnProperty("venue_name") &&
    !updateObject.hasOwnProperty("description") &&
    !updateObject.hasOwnProperty("picture") &&
    !updateObject.hasOwnProperty("address")
  ) {
    return res
      .status(400)
      .send(`Error updating events on venue with id 3!`);
  }
  return await dbConnect.collection("Venues").updateOne({
    _id: ObjectId(id)
  }, { $set: updateObject }, function(err, _result) {
    if (err) {
      return res
        .status(400)
        .send(`Error updating events on venue with id 2!`);
    } else {
      console.log("Document updated");
      return res.status(200).send(req.body);
    }
  });
};

exports.deleteVenue = async (req, res) => {
  const dbConnect = dbo.getDb();

  const id = req.params.venue_id;

  await dbConnect
    .collection("Venues")
    .deleteOne({ _id: ObjectId(id) }, function(err, _result) {
      if (_result.deletedCount === 0) {
        res.status(400).send("No venue to delete");
      } else if (err) {
        res.status(400).send(`Error deleting venue with id!`);
      } else {
        console.log("Document deleted");
        res.status(204).send();
      }
    });
};
