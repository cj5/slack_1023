require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const { format } = require('date-fns')
const fromUnixTime = require('date-fns/fromUnixTime')

const { WebClient } = require('@slack/web-api')
const web = new WebClient(process.env.SLACK_OATH_TOKEN)
const { createEventAdapter } = require('@slack/events-api')
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
const slackEvents = createEventAdapter(slackSigningSecret)
app.use('/', slackEvents.requestListener())

app.use(bodyParser.json())

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

const alex = 'U1FA8UTV2'
const chris = 'U1ESXHU6S'
const john = 'U6AFFTWTH'

let time
const checkTime = (timeFromSlack) => {
  const timeFull = fromUnixTime(timeFromSlack)
  time = format(timeFull, 'h:mm:ss')
}

slackEvents.on('message', (e) => {
  (async () => {
    if (e.text === 'a') {
      const channelId = e.channel
      console.log(e.channel)
      let user

      checkTime(e.ts)

      if (e.user === alex) {
        user = 'Alex'
      } else if (e.user === chris) {
        user = 'CJ'
      } else if (e.user === john) {
        user = 'John'
      }

      let response = `${user} at: ${time}`

      try {
        const result = await web.chat.postMessage({
          text: response,
          channel: channelId,
        })

        console.log('\n\n\n', e)
      } catch (err) {
        console.log('ERROR:', err)
      }
    }
  })()
})

app.get('/', (req, res) => {
  res.send('Slack 1023 app')
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
