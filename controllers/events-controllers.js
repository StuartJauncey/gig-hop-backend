const { ObjectId } = require("bson");
const dbo = require("../connection");

exports.getAllEvents = (req, res) => {
  const dbConnect = dbo.getDb();
  let defaultDay = new Date(new Date().setHours(5, 0, 0, 0));
  let day2 = new Date(defaultDay.getTime() + 1000 * 60 * 60 * 24);
  console.log(defaultDay, day2);
  if (req.query.filter_by) {
    defaultDay = new Date(req.query.filter_by);
    day2 = new Date(
      defaultDay.getTime() + 1000 * 60 * 60 * 24
    ).setHours(5, 0, 0, 0);
  }
  let query = req.query;
  if (req.query.sort_by || req.query.filter_by) {
    return dbConnect
      .collection("Events")
      .aggregate([
        {
          $addFields: { venue_id: { $toObjectId: "$venue_id" } }
        },
        {
          $match: {
            time_end: {
              $gte: new Date(defaultDay),
              $lt: new Date(day2)
            }
          }
        },
        {
          $lookup: {
            from: "Venues",
            localField: "venue_id",
            foreignField: "_id",
            as: "venue_info"
          }
        }
      ])
      .sort({ [query.sort_by]: -1 })
      .toArray((err, result) => {
        return res.json(result);
      });
  }

  return dbConnect
    .collection("Events")
    .aggregate([
      {
        $addFields: { venue_id: { $toObjectId: "$venue_id" } }
      },
      {
        $lookup: {
          from: "Venues",
          localField: "venue_id",
          foreignField: "_id",
          as: "venue_info"
        }
      }
    ])
    .toArray((err, result) => {
      return res.json(result);
    });
};

exports.getEvent = (req, res) => {
  const dbConnect = dbo.getDb();
  const id = req.params.event_id;
  dbConnect
    .collection("Events")
    .aggregate([
      {
        $addFields: { venue_id: { $toObjectId: "$venue_id" } }
      },
      {
        $match: {
          _id: ObjectId(id)
        }
      },
      {
        $lookup: {
          from: "Venues",
          localField: "venue_id",
          foreignField: "_id",
          as: "venue_info"
        }
      }
    ])
    .toArray((err, result) => {
      return res.json(result);
    });
};

exports.postNewEvent = async (req, res) => {
  const dbConnect = dbo.getDb();
  const newObj = req.body;
  if (!newObj.picture) {
    newObj.picture =
      "https://jollycontrarian.com/images/thumb/a/a4/Andrex.jpg/450px-Andrex.jpg";
  }

  const startTime = new Date(newObj.time_start);
  const endTime = new Date(newObj.time_end);

  newObj.time_start = startTime;
  newObj.time_end = endTime;

  const expectedKeys = [
    "event_name",
    "entry_price",
    "description",
    "venue_id",
    "user_id",
    "artists_ids",
    "authorised",
    "time_end",
    "time_start",
    "picture"
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
    .collection("Events")
    .insertOne(newObj, function(err, result) {
      if (err) {
        res.status(400).send("Error inserting matches!");
      } else {
        console.log(`Added a new match with id ${result.insertedId}`);
        res.status(200).send(result.insertedId);
      }
    });
};

exports.deleteEvent = async (req, res) => {
  const dbConnect = dbo.getDb();

  const id = req.params.event_id;

  await dbConnect
    .collection("Events")
    .deleteOne({ _id: ObjectId(id) }, function(err, _result) {
      if (_result.deletedCount === 0) {
        res.status(400).send("No event to delete");
      } else if (err) {
        res.status(400).send(`Error deleting event with id!`);
      } else {
        console.log("Document deleted");
        res.status(204).send();
      }
    });
};

exports.patchEvent = async (req, res) => {
  const dbConnect = dbo.getDb();
  const updateObject = req.body;
  const id = req.params.event_id;

  let event;

  await dbConnect
    .collection("Events")
    .findOne({ _id: ObjectId(id) })
    .then(result => {
      event = result;
    });

  if (updateObject.hasOwnProperty("authorised")) {
    if (
      updateObject.authorised.hasOwnProperty("artist") ||
      updateObject.authorised.hasOwnProperty("venue")
    ) {
      if (
        typeof updateObject.authorised.artist === "boolean" ||
        typeof updateObject.authorised.venue === "boolean"
      ) {
        return await dbConnect
          .collection("Events")
          .updateOne(
            {
              _id: ObjectId(id)
            },
            { $set: updateObject }
          )
          .then(result => {
            if (result.modifiedCount !== 0) {
              res.status(200).send(updateObject);
            } else {
              res.status(400).send("No content updated.");
            }
          });
      }
    }
  }

  if (updateObject.hasOwnProperty("entry_price")) {
    return await dbConnect
      .collection("Events")
      .updateOne(
        {
          _id: ObjectId(id)
        },
        { $set: updateObject }
      )
      .then(result => {
        if (result.modifiedCount !== 0) {
          return res.status(200).send(result);
        } else {
          return res.status(400).send("entry price not modified");
        }
      });
  }

  if (updateObject.hasOwnProperty("add_artist")) {
    for (let i = 0; i < event.artists_ids.length; i++) {
      if (
        event.artists_ids[i].artist_id ===
        updateObject.add_artist.artist_id
      ) {
        return res.status(400).send("artist already in there");
      }
    }
    return await dbConnect.collection("Events").updateOne({
      _id: ObjectId(id)
    }, {
      $push: {
        artists_ids: updateObject.add_artist
      }
    }, function(err, _result) {
      if (err) {
        res.status(400).send(`Error updating events on artist`);
      } else {
        console.log("artist added to event");
        res.status(200).send(updateObject.add_artist);
      }
    });
  }

  console.log(updateObject);

  if (updateObject.hasOwnProperty("remove_artist")) {
    return await dbConnect.collection("Events").findOneAndUpdate({
      _id: ObjectId(id)
    }, {
      $pull: {
        artists_ids: updateObject.remove_artist
      }
    }, function(err, _result) {
      if (err) {
        return res.status(400).send("Error removing artist");
      } else {
        return res.status(200).send();
      }
    });
  }

  if (
    !updateObject.hasOwnProperty("artist_id") &&
    !updateObject.hasOwnProperty("venue_id") &&
    !updateObject.hasOwnProperty("description") &&
    !updateObject.hasOwnProperty("picture") &&
    !updateObject.hasOwnProperty("user_id") &&
    !updateObject.hasOwnProperty("time_end") &&
    !updateObject.hasOwnProperty("time_start") &&
    !updateObject.hasOwnProperty("event_name")
  ) {
    return res
      .status(400)
      .send(`Error updating events on venue with id 3!`);
  }

  console.log(updateObject);
  return await dbConnect
    .collection("Events")
    .updateOne(
      {
        _id: ObjectId(id)
      },
      { $set: updateObject }
    )
    .then(result => {
      if (result.modifiedCount === 0) {
        res
          .status(400)
          .send(`Error updating events on venue with id 2!`);
      } else {
        res.status(200).send(result);
      }
    });
};
