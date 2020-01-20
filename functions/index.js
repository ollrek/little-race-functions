const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./little-race-firebase-adminsdk-awscw-4469ee488a.json')) });

// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');
const ProgressFct = require('./src/getProgress');
const { dailyTally, generateParentLeagues } = require('./src/leagueManager');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.testGetAllProgress = functions.https.onRequest((request, response) => {
//     ProgressFct.getAllProgress().then((data) => {
//         response.send(JSON.stringify)
//     }).catch((e) => {
//         console.log(e);
//         response.send(e)
// ;    })
// });

// exports.generateInit = functions.https.onRequest((request, response) => {
//     generateParentLeagues();
// });

exports.testDailyTally = functions.https.onRequest((request, response) => {
    dailyTally();
});

exports.getAllProgress = functions.pubsub.schedule('every monday 05:00').onRun((context) => {
    ProgressFct.getAllProgress();
});
