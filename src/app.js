require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const { utcToZonedTime, format } = require('date-fns-tz')
const fromUnixTime = require('date-fns/fromUnixTime')
const { WebClient } = require('@slack/web-api')
const web = new WebClient(process.env.SLACK_OATH_TOKEN)
const { createEventAdapter } = require('@slack/events-api')
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET
const slackEvents = createEventAdapter(slackSigningSecret)

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
// test user CJ2 = 'U01HD50K9HB'
// test channel CJ-CJ2 = 'D01HG7L8V4J'
const alex = 'U1FA8UTV2'
const cj = 'U1ESXHU6S'
const john = 'U6AFFTWTH'
const line = '————————————————'
const channel = 'G6C3FD3V5' // Alex-CJ-John DM
const penaltyVal = 120
let slackTime_hm
let slackTime_s
let winners = 0
let timeout = 0
let userState = [{
  user: 'Alex',
  pts: 0,
  totalPts: 0,
  penalty: false,
}, {
  user: 'CJ__',
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
  let timeFull = fromUnixTime(timeFromSlack)
  let timeFullCST = utcToZonedTime(timeFull, 'America/Chicago')
  slackTime_hms = format(timeFullCST, 'h:mm:ss')
  slackTime_hm = format(timeFullCST, 'h:mm')
  slackTime_s = format(timeFullCST, 'ss')
}

const updatePlayerPoints = async (user, pts) => {
  try {
    const doc = await Player.findOne({ name: user })
    let totalPts = doc.points += pts
    await Player.findOneAndUpdate(
      { name: user },
      { points: totalPts },
      { new: true },
    )
  } catch(err) {
    console.log('error in updatePlayerPoints()', err)
  }
}

const updateAllPlayerPoints = async () => {
  try {
    await updatePlayerPoints('Alex', userState[0].pts)
    await updatePlayerPoints('CJ__', userState[1].pts)
    await updatePlayerPoints('John', userState[2].pts)
  } catch(err) {
    console.log('error in updateAllPlayerPoints()', err)
  }
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
  try {
    const doc = await Player.findOne({ name: user })
    let totalPts = doc.points += pts
    userState.map(x => {
      if (x.user === user) {
        x.totalPts = totalPts
      }
    })
  } catch(err) {
    console.log('error in updateUserTotalPoints()', err)
  }
}

const updateAllUserTotalPoints = async () => {
  try {
    await updateUserTotalPoints('Alex', userState[0].pts)
    await updateUserTotalPoints('CJ__', userState[1].pts)
    await updateUserTotalPoints('John', userState[2].pts)
  } catch(err) {
    console.log('error in updateAllUserTotalPoints', err)
  }
}

const updateRoundsPlayed = async () => {
  try {
    const rounds = await Rounds.findById(db.RoundsID).exec()
    let roundsPlayed = rounds.played
    console.log('prev rounds played:', roundsPlayed)
    roundsPlayed++
    await Rounds.updateOne(
      { played: roundsPlayed }
    )
    console.log('curr rounds played:', roundsPlayed)
  } catch(err) {
    console.log('error in updateRoundsPlayed()', err)
  }
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
  try {
    web.chat.postMessage({ text, channel })
  } catch(err) {
    console.log('error in postToSlack()', err)
  }
}

const displayTitle = () => {
  return title = `
${line}
*10:23 GAME*  :clock1030:
`
}

const displayByPoints = () => {
  const sortByPts = [...userState].sort(by('pts'))

  return roundScores = `
*${sortByPts[0].user}* — \`${sortByPts[0].pts}\`
*${sortByPts[1].user}* — \`${sortByPts[1].pts}\`
*${sortByPts[2].user}* — \`${sortByPts[2].pts}\``
}

const displayByTotalPoints = () => {
  const sortByTotalPts = [...userState].sort(by('totalPts'))

  return totalScores = `
*${sortByTotalPts[0].user}* — \`${sortByTotalPts[0].totalPts}\`  :first_place_medal:
*${sortByTotalPts[1].user}* — \`${sortByTotalPts[1].totalPts}\`  :second_place_medal:
*${sortByTotalPts[2].user}* — \`${sortByTotalPts[2].totalPts}\`  :third_place_medal:
${line}`
}

const postToSlackAndUpdate = () => {
  console.log('postToSlackAndUpdate()')
  setTimeout(() => {
    (async() => {
      try {
        displayTitle()
        displayByPoints()
        displayByTotalPoints()

        const response = `
${title}
_ROUND SCORES_:
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
  try {
    formatSlackTime(e.ts)
    console.log('Slack EVENT —', slackTime_hms)

    if (e.channel === channel) {
      if (e.text === ':1023:' || e.text === ':1023: ') {
        if (slackTime_hm === '10:23') {

          if (e.user === alex) {
            updateUserPoints('Alex')
          } else if (e.user === cj) {
            updateUserPoints('CJ__')
          } else if (e.user === john) {
            updateUserPoints('John')
          }

          await updateAllUserTotalPoints()
          postToSlackAndUpdate()

        } else { // User posted outside 10:23

          const penaltyMsg = `posted outside of 10:23 at ${slackTime_hms} and will be deducted ${penaltyVal} points`
          const penaltyEmoji = ':no_entry_sign:'

          if (e.user === alex) {
            await postToSlack(`${penaltyEmoji} Alex ${penaltyMsg}`)
            updateUserPenalty('Alex')
            updateUserPoints('Alex')
          } else if (e.user === cj) {
            await postToSlack(`${penaltyEmoji} CJ ${penaltyMsg}`)
            updateUserPenalty('CJ__')
            updateUserPoints('CJ__')
          } else if (e.user === john) {
            await postToSlack(`${penaltyEmoji} John ${penaltyMsg}`)
            updateUserPenalty('John')
            updateUserPoints('John')
          }

          await updateAllUserTotalPoints()
          postToSlackAndUpdate()
        }
      }
      if (e.text === '1023') { // If user posts '1023', it will display stats

        const alex = await Player.findOne({ name: 'Alex' })
        userState[0].totalPts = alex.points
        const cj = await Player.findOne({ name: 'CJ__' })
        userState[1].totalPts = cj.points
        const john = await Player.findOne({ name: 'John' })
        userState[2].totalPts = john.points

        displayTitle()
        displayByTotalPoints()

        const response =`
${title}
_LEADERBOARD_:
${totalScores}`

        await postToSlack(response)
      }
    }
  } catch(err) {
    console.log('error in Slack event', err)
  }
})
// **END** SLACK INTERACTION
// %%%%%%%%%%%%%%%%%%%%%%%

app.listen(port, () => {
  console.log('Express app is up')
})
