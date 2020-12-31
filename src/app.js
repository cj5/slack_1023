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
const penaltyVal = 240
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
const testUser = 'U01HD50K9HB' // CJ2
const alex = 'U1FA8UTV2'
const cj = 'U1ESXHU6S' // 1798
const john = 'U6AFFTWTH'
let slackTime_hm
let slackTime_s
let channelId
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
}

const updateUserPoints = (user) => {
  userState.map(x => {
    if (x.user === user && x.pts === 0) {
      console.log(user)
      if (x.penalty) {
        x.pts = 0 - penaltyVal
      } else {
        let diff = 60 - slackTime_s
        x.pts = diff
        winners++
        if (winners === 1) timeout = diff * 1000 - 1500
        console.log(`timeout: ${timeout}, winners: ${winners}`)
      }
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

const postToSlack = (text) => {
  web.chat.postMessage({
    text,
    channel: channelId,
  })
}

const postToSlackAndUpdate = () => {
  setTimeout(() => {
    (async() => {
      try {
        const comparePts = (a, b) => {
          const c1 = a.pts
          const c2 = b.pts

          let comparison = 0
          if (c1 > c2) {
            comparison = 1
          } else if (c1 < c2) {
            comparison = -1
          }
          return comparison * -1
        }
        const sortByPts = [...userState].sort(comparePts)

        const roundScores =
`*${sortByPts[0].user}* — \`${sortByPts[0].pts}\`
*${sortByPts[1].user}* — \`${sortByPts[1].pts}\`
*${sortByPts[2].user}* — \`${sortByPts[2].pts}\``

        const compareTotalPts = (a, b) => {
          const c1 = a.totalPts
          const c2 = b.totalPts

          let comparison = 0
          if (c1 > c2) {
            comparison = 1
          } else if (c1 < c2) {
            comparison = -1
          }
          return comparison * -1
        }
        const sortByTotalPts = [...userState].sort(compareTotalPts)

        const totalScores =
`*${sortByTotalPts[0].user}* — \`${sortByTotalPts[0].totalPts}\`
*${sortByTotalPts[1].user}* — \`${sortByTotalPts[1].totalPts}\`
*${sortByTotalPts[2].user}* — \`${sortByTotalPts[2].totalPts}\``

        const response =
`_ROUND SCORES_:
${roundScores}

_LEADERBOARD_:
${totalScores}`

        await web.chat.postMessage({
          text: response,
          channel: channelId,
        })

        await updateAllPlayerPoints()

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
  if (e.text === 'a' || e.text === ':1023:' || e.text === ':1023: ') {
    // const targetTime = format(new Date(), 'h:mm')
    const targetTime = '10:23'
    channelId = e.channel
    formatSlackTime(e.ts)

    if (
      slackTime_hm === '1:23' ||
      slackTime_hm === '2:23' ||
      slackTime_hm === '3:23' ||
      slackTime_hm === '4:23' ||
      slackTime_hm === '5:23' ||
      slackTime_hm === '6:23' ||
      slackTime_hm === '7:23' ||
      slackTime_hm === '8:23' ||
      slackTime_hm === '9:23' ||
      slackTime_hm === '10:23' ||
      slackTime_hm === '11:23' ||
      slackTime_hm === '12:23'
    ) {
      console.log(`slackTime_hm: ${slackTime_hm}, targetTime: ${targetTime}`)
      if (e.user === alex) {
        updateUserPoints('Alex')
      } else if (e.user === cj) {
        updateUserPoints('CJ')
      } else if (e.user === john) {
        updateUserPoints('John')
      }

      await updateAllUserTotalPoints()
      updateRoundsPlayed()
      postToSlackAndUpdate()

    } else {

      const penaltyMsg = `posted outside of XX:23 at ${slackTime_hm}:${slackTime_s} and will be deducted ${penaltyVal} points`
      const penaltyEmoji = ':no_entry_sign:'

      if (e.user === alex) {
        postToSlack(`${penaltyEmoji} Alex ${penaltyMsg}`)
        updateUserPenalty('Alex')
        updateUserPoints('Alex')
      } else if (e.user === cj) {
        postToSlack(`${penaltyEmoji} CJ ${penaltyMsg}`)
        updateUserPenalty('CJ')
        updateUserPoints('CJ')
      } else if (e.user === john) {
        postToSlack(`${penaltyEmoji} John ${penaltyMsg}`)
        updateUserPenalty('John')
        updateUserPoints('John')
      }

      await updateAllUserTotalPoints()
      updateRoundsPlayed()
      postToSlackAndUpdate()
    }
  }
})
// **END** SLACK INTERACTION
// %%%%%%%%%%%%%%%%%%%%%%%

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
