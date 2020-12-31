const mongoose = require('mongoose')

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
})
const Player = mongoose.model('Player', playerSchema)

const roundsSchema = new mongoose.Schema({
  played: Number,
})
const Rounds = mongoose.model('Rounds', roundsSchema)
const RoundsID = '5fe93547b8a9c45c2c5c75b6'

exports.Player = Player
exports.Rounds = Rounds
exports.RoundsID = RoundsID
