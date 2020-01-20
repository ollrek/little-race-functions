const admin = require('firebase-admin');

const fetch = require('node-fetch');
const spark = admin.app("spark");
const db = spark.firestore()

async function getAllProgress() {
    var guilds = [];
    guilds = await db.collection("guilds").where('active', '==', true).get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                guilds.push(Object.assign(doc.data(), { id: doc.id }));
            })
            return guilds;
        }).catch((e) => {
            console.log(e)
        });

    guilds.forEach(guild => {
        const params = (({ region, realm, name }) => ({ region, realm, name }))(guild);
        const params_string = Object.keys(params).map((key) => {
            return key + '=' + params[key];
        }).join('&');

        fetch('https://raider.io/api/v1/guilds/profile?' + params_string + '&fields=raid_rankings,raid_progression')
            .then(res => res.json())
            .then(json => {
                if (json.error) console.log(params_string + ' KO ' + json.message)
                else {
                    db.collection("guilds").doc(guild.id).update({ raid_rankings: json.raid_rankings, raid_progression: json.raid_progression })
                        .then(() => {
                            console.log(params_string + ' OK');
                            return;
                        })
                        .catch((error) => {
                            throw new Error("Error updating document: " + error);
                        });
                }

                return;
            }).catch((error) => {
                console.error(error);
            });
    })

    db.collection("stats").doc('active').update({
        value: guilds.length
    });
}

module.exports = {
    getAllProgress
}