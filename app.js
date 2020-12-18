require('dotenv').config()
const express = require('express')
const app = express()
const port = 3000
const mongoose = require('mongoose')
var bodyParser = require('body-parser')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const DB = process.env.DB.replace('<password>', process.env.DB_PSWD)

mongoose.connect(DB, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
})
.then(() => console.log('DB connnection successful'))

const playerSchema = new mongoose.Schema({
  name: String,
  points: Number,
  win_solo: Number,
  win_shared_1: Number,
  win_shared_2: Number
})

const Player = mongoose.model('Player', playerSchema)

const updatePlayerPoints = (req, res, name) => {
  Player.findOneAndUpdate(
    { name },
    req.body,
    { new: true },
    (err, doc) => {
      if (err) {
        res.send(err)
      } else {
        res.send(JSON.stringify(doc, null, 2))
      }
    }
  )
}

app.post('/', (req, res) => {
  updatePlayerPoints(req, res, 'Chris')
})

app.post('/challenge', (req, res) => {
  console.log(JSON.stringify(req.body, null, 2))
  res.status(200).send(req.body.challenge)
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
