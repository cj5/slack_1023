require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const mongoose = require('mongoose')
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
})
const Player = mongoose.model('Player', playerSchema)
// **END** DATABASE
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// GLOBAL VARIABLES
const testUser = 'U01HD50K9HB' // CJ2
const alex = 'U1FA8UTV2'
const chris = 'U1ESXHU6S'
const john = 'U6AFFTWTH'
let slackTime_hm
let slackTime_s
let channelId
let response
let winners = 0
let timeout = 60000
let userState = [{
  user: 'Alex',
  pts: 0,
  totalPts: 0,
}, {
  user: 'Chris',
  pts: 0,
  totalPts: 0,
}, {
  user: 'John',
  pts: 0,
  totalPts: 0,
}]
// **END** GLOBAL VARIABLES
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// FUNCTIONS
const updatePlayerPoints = async (user, pts) => {
  const doc = await Player.findOne({ name: user })
  let totalPts = doc.points += pts

  await Player.findOneAndUpdate(
    { name: user },
    { points: totalPts },
    { new: true },
  )
}

const checkTime = (timeFromSlack) => {
  const timeFull = fromUnixTime(timeFromSlack)
  slackTime_hm = format(timeFull, 'h:mm')
  slackTime_s = format(timeFull, 'ss')
}

const updateUserPoints = (user) => {
  userState.map(x => {
    let diff
    if (x.user === user && x.pts === 0) {
      diff = 60 - slackTime_s
      x.pts = diff
      winners++
      if (winners === 1) timeout = diff * 1000 - 1500
      console.log(`timeout: ${timeout}, winners: ${winners}`)
    }
  })
}

const updateUserTotalPoints = async (user, pts) => {
  const doc = await Player.findOne({ name: user })
  let totalPts = doc.points += pts

  userState.map(x => {
    if (x.user === user) {
      x.totalPts = totalPts
    }
  })
}

const post = () => {
  setTimeout(() => {
    (async() => {
      try {
        console.log('postMessage()')

        await web.chat.postMessage({
          text: response,
          channel: channelId,
        })

        await updatePlayerPoints('Alex', userState[0].pts)
        await updatePlayerPoints('Chris', userState[1].pts)
        await updatePlayerPoints('John', userState[2].pts)

        process.exit(1)
      } catch (err) {
        console.log('ERROR:', err)
      }
    })()
  }, timeout)
}
// **END** FUNCTIONS
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// SLACK INTERACTION
slackEvents.on('message', async (e) => {
  console.log('Slack EVENT')
  if (e.text === 'a' || e.text === ':1023:') {
    const targetTime = format(new Date(), 'h:mm')
    // const targetTime = '10:23'
    channelId = e.channel
    checkTime(e.ts)

    if (e.user === 'U1FA8UTV2') {
      console.log('Alex')
    } else if (e.user === 'U1ESXHU6S') {
      console.log('CJ')
    } else if (e.user === 'U6AFFTWTH') {
      console.log('John')
    }

    console.log(`slackTime_hm: ${slackTime_hm}, targetTime: ${targetTime}`)
    // if (slackTime_hm === targetTime) {
      if (e.user === alex) {
        updateUserPoints('Alex')
      } else if (e.user === chris) {
        updateUserPoints('Chris')
      } else if (e.user === john) {
        updateUserPoints('John')
      }

      await updateUserTotalPoints('Alex', userState[0].pts)
      await updateUserTotalPoints('Chris', userState[1].pts)
      await updateUserTotalPoints('John', userState[2].pts)

      response =
`_ROUND SCORES_:
*Alex* — \`${userState[0].pts}\`
*CJ__* — \`${userState[1].pts}\`
*John* — \`${userState[2].pts}\`

_RUNNING TOTALS_:
*Alex* — \`${userState[0].totalPts}\`
*CJ__* — \`${userState[1].totalPts}\`
*John* — \`${userState[2].totalPts}\``
    // } else {
      // response = `Not posted at ${targetTime}`
    // }

    post()
  }
})
// **END** SLACK INTERACTION
// %%%%%%%%%%%%%%%%%%%%%%%

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
