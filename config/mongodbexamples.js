// получить ISODate("2018-01-20T12:28:57Z")
ObjectId("507c7f79bcf86cd7994f6c0e").getTimestamp()

// получить "5a633609670aeb6f93b88b15"
ObjectId("5a633609670aeb6f93b88b15").valueOf()
ObjectId("5a633609670aeb6f93b88b15").str

// новый ID
ObjectId()


// добавить TimeStamp and ISODate
db.roles.findAndModify({
  query: {name: "admin"},
  update: {
    $currentDate: {
      modified: true,
      created: {$type: "timestamp"}
    }
  }
});

update({}, {$currentDate: {
    field : true, //new Date()
    field1: {$type: "date"}, //new Date()
    field2: {$type: "timestamp"} //new Timestamp()
  }}


// или так
var a = new Timestamp();
db.test.insertOne({ts: a});
// Then, the db.test.find() operation will return a document that resembles the following:
{
  "_id": ObjectId("542c2b97bac0595474108b48"),
  "ts": Timestamp(1412180887, 1)
}


// итерации
db.todo.find().snapshot().forEach(
  function (e) {
    delete e.id
    if (e.date) {
      e.stamp = e.date;
    }
    db.todo.save(e);
  }
)

db.mail.find().sort({stamp:-1}).limit(1000).forEach(
  function (e) {
    let size = Object.bsonsize(e);
    if (size > 1024 * 1024) {
      print(e._id, Object.bsonsize(e));
    }
  }
)
