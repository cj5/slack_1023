require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const { format } = require('date-fns')
const fromUnixTime = require('date-fns/fromUnixTime')

const { WebClient } = require('@slack/web-api')
const web = new WebClient(process.env.SLACK_OATH_TOKEN)
const { createEventAdapter } = require('@slack/events-api')
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
const slackEvents = createEventAdapter(slackSigningSecret)
const penaltyVal = 120
app.use('/', slackEvents.requestListener())

// %%%%%%%%%%%%%%%%%%%%%%%
// DATABASE
const db = require('./db')
const Player = db.Player
const Rounds = db.Rounds
// **END** DATABASE
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// GLOBAL VARIABLES
// const alex = 'U01HD50K9HB' // CJ2
const alex = 'U1FA8UTV2'
const cj = 'U1ESXHU6S'
const john = 'U6AFFTWTH'
let slackTime_hm
let slackTime_m
let slackTime_s
let channel
let winners = 0
let timeout = 0
let userState = [{
  user: 'Alex',
  pts: 0,
  totalPts: 0,
  penalty: false,
}, {
  user: 'CJ',
  pts: 0,
  totalPts: 0,
  penalty: false,
}, {
  user: 'John',
  pts: 0,
  totalPts: 0,
  penalty: false,
}]
// **END** GLOBAL VARIABLES
// %%%%%%%%%%%%%%%%%%%%%%%

// %%%%%%%%%%%%%%%%%%%%%%%
// FUNCTIONS
const formatSlackTime = (timeFromSlack) => {
  const timeFull = fromUnixTime(timeFromSlack)
  slackTime_hm = format(timeFull, 'h:mm')
  slackTime_m = format(timeFull, 'mm')
  slackTime_s = format(timeFull, 'ss')
}

const updatePlayerPoints = async (user, pts) => {
  const doc = await Player.findOne({ name: user })
  let totalPts = doc.points += pts
  await Player.findOneAndUpdate(
    { name: user },
    { points: totalPts },
    { new: true },
  )
}

const updateAllPlayerPoints = async () => {
  await updatePlayerPoints('Alex', userState[0].pts)
  await updatePlayerPoints('CJ', userState[1].pts)
  await updatePlayerPoints('John', userState[2].pts)
}

const updateUserPenalty = (user) => {
  userState.map(x => {
    if (x.user === user) {
      x.penalty = true
    }
  })
  console.log(`${user} committed a penalty`)
}

const updateUserPoints = (user) => {
  userState.map(x => {
    if (x.user === user && x.pts === 0) {
      if (x.penalty) {
        x.pts = 0 - penaltyVal
      } else {
        let diff = 60 - slackTime_s
        x.pts = diff
        winners++
        if (winners === 1) timeout = diff * 1000
        console.log(`timeout: ${timeout}, winners: ${winners}`)
      }
      console.log(user, `— pts: ${x.pts}`)
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

const updateAllUserTotalPoints = async () => {
  await updateUserTotalPoints('Alex', userState[0].pts)
  await updateUserTotalPoints('CJ', userState[1].pts)
  await updateUserTotalPoints('John', userState[2].pts)
}

const updateRoundsPlayed = async () => {
  const rounds = await Rounds.findById(db.RoundsID).exec()
  let roundsPlayed = rounds.played
  console.log('prev rounds played:', roundsPlayed)
  roundsPlayed++
  await Rounds.updateOne(
    { played: roundsPlayed }
  )
  console.log('curr rounds played:', roundsPlayed)
}

const by = (property) => {
  return (a, b) => {
    let result = 0
    if (a[property] < b[property]) {
      result = 1
    } else if (a[property] > b[property]) {
      result = -1
    }
    return result
  }
}

const postToSlack = async (text) => {
  web.chat.postMessage({ text, channel })
}

const postToSlackAndUpdate = () => {
  setTimeout(() => {
    (async() => {
      try {

        const sortByPts = [...userState].sort(by('pts'))

        const roundScores =
`*${sortByPts[0].user}* — \`${sortByPts[0].pts}\`
*${sortByPts[1].user}* — \`${sortByPts[1].pts}\`
*${sortByPts[2].user}* — \`${sortByPts[2].pts}\``

        const sortByTotalPts = [...userState].sort(by('totalPts'))

        const totalScores =
`*${sortByTotalPts[0].user}* — \`${sortByTotalPts[0].totalPts}\`
*${sortByTotalPts[1].user}* — \`${sortByTotalPts[1].totalPts}\`
*${sortByTotalPts[2].user}* — \`${sortByTotalPts[2].totalPts}\``

        const response =
`_ROUND SCORES_:
${roundScores}

_LEADERBOARD_:
${totalScores}`

        await postToSlack(response)
        await updateAllPlayerPoints()
        await updateRoundsPlayed()

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
  channel = e.channel
  console.log('Slack EVENT')
  if (e.text === ':1023:' || e.text === ':1023: ' || e.text === 'a') {
    // const targetTime = format(new Date(), 'h:mm')
    const targetTime = '10:23'
    formatSlackTime(e.ts)

    if (
      slackTime_hm === '10:23' ||
      slackTime_m === '00' ||
      slackTime_m === '15' ||
      slackTime_m === '30' ||
      slackTime_m === '45'
    ) {
      console.log(`slackTime: ${slackTime_hm}:${slackTime_s}, targetTime: ${targetTime}`)
      if (e.user === alex) {
        updateUserPoints('Alex')
      } else if (e.user === cj) {
        updateUserPoints('CJ')
      } else if (e.user === john) {
        updateUserPoints('John')
      }

      await updateAllUserTotalPoints()
      postToSlackAndUpdate()

    } else { // User posted outside 10:23

      const penaltyMsg = `posted outside of 10:23, XX:00, XX:15, XX:30 or XX:45 at ${slackTime_hm}:${slackTime_s} and will be deducted ${penaltyVal} points`
      const penaltyEmoji = ':no_entry_sign:'

      if (e.user === alex) {
        await postToSlack(`${penaltyEmoji} Alex ${penaltyMsg}`)
        updateUserPenalty('Alex')
        updateUserPoints('Alex')
      } else if (e.user === cj) {
        await postToSlack(`${penaltyEmoji} CJ ${penaltyMsg}`)
        updateUserPenalty('CJ')
        updateUserPoints('CJ')
      } else if (e.user === john) {
        await postToSlack(`${penaltyEmoji} John ${penaltyMsg}`)
        updateUserPenalty('John')
        updateUserPoints('John')
      }

      await updateAllUserTotalPoints()
      await updateRoundsPlayed()
      postToSlackAndUpdate()
    }
  }
  if (e.text === '1023') {
    await postToSlack('hey, this should be 1023 game stats')
  }
})
// **END** SLACK INTERACTION
// %%%%%%%%%%%%%%%%%%%%%%%

app.listen(port, () => {
  console.log('Express app is up')
})
