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

// %%%%%%%%%%%%%%%%%%%%%%%
// DATABASE
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
// **END** DATABASE
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// GLOBAL VARIABLES
const alex = 'U1FA8UTV2'
const chris = 'U1ESXHU6S'
const john = 'U6AFFTWTH'
let slackTime
let slackTime_hrsMins
let channelId
let response
const timeout = 5000
// **END** GLOBAL VARIABLES
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// FUNCTIONS
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

const checkTime = (timeFromSlack) => {
  const timeFull = fromUnixTime(timeFromSlack)
  slackTime = format(timeFull, 'h:mm:ss')
  slackTime_hrsMins = format(timeFull, 'h:mm')
}

const updateUserState = (user) => {
  let winners = 1

  userState.map(x => {
    if (x.user === user && x.pts === 0) {
      userState.map(y => {
        if (y.pts > 0) {
          winners++
        }
      })

      if (winners === 1) {
        x.pts = 3
      } else if (winners === 2) {
        x.pts = 1.5
      } else if (winners === 3) {
        x.pts = 1
      }
    }

    userState.map(x => {
      if (winners === 2 && x.pts > 0) {
        x.pts = 1.5
      } else if (winners === 3 && x.pts > 0) {
        x.pts = 1
      }
    })
  })
}

const resetState = () => {
  userState.map(x => x.pts = 0)
  console.log('resetState()')
}
// **END** FUNCTIONS
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// USER STATE
let userState = [{
  user: 'alex',
  pts: 0
}, {
  user: 'chris',
  pts: 0
}, {
  user: 'john',
  pts: 0
}]
// **END** USER STATE
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// SLACK INTERACTION
slackEvents.on('message', (e) => {
  if (e.text === 'a') {
    channelId = e.channel

    checkTime(e.ts)

    const targetTime = format(new Date(), 'h:mm')

    if (slackTime_hrsMins === targetTime) {
      if (e.user === alex) {
        user = 'Alex'
        updateUserState('alex')
      } else if (e.user === chris) {
        user = 'CJ'
        updateUserState('chris')
      } else if (e.user === john) {
        user = 'John'
        updateUserState('john')
      }

      response = `\nAlex: ${userState[0].pts}\nCJ: ${userState[1].pts}\nJohn: ${userState[2].pts}`
    } else {
      response = `Not posted at ${targetTime}`
    }

    post()
  }
})
// **END** SLACK INTERACTION
// %%%%%%%%%%%%%%%%%%%%%%%

function post() {
  setTimeout(() => {
    (async() => {
      try {
        console.log('postMessage()')

        await web.chat.postMessage({
          text: response,
          channel: channelId,
        })
        process.exit(1)
      } catch (err) {
        console.log('ERROR:', err)
      }
    })()
  }, timeout)
}

app.get('/', (req, res) => {
  res.send('Slack 1023 app')
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
