const admin = require('firebase-admin');
const spark = admin.app("spark");
const db = spark.firestore()

const { RAID_SIZE, RAID_TIME } = require('../data/leagueNameByObj');
const getSlug = require('speakingurl');

// Arbitrary league size
const leagueSize = 20;

async function generateParentLeagues() {
    // Get next progress
    progress = await db.collection("progress").where('status', '==', 2).get()
        .then((snapshot) => {
            if (!snapshot.empty) {
                return snapshot.docs[0].data().slug;
            }
            else return '';
        }).catch((e) => {
            console.log(e)
        });

    const { RAID_MODE } = require('../data/' + progress);

    for (let [mKey, mValue] of Object.entries(RAID_MODE)) {
        for (let [sKey, sValue] of Object.entries(RAID_SIZE)) {
            for (let [tKey, tValue] of Object.entries(RAID_TIME)) {
                dbRef = db.collection("leagues").doc(progress).collection("objective").doc(String(mKey * 100 + sKey * 10 + Number(tKey))).set({
                    name: `${tValue} ${mValue.name} ${sValue}`,
                    slug: getSlug(`${tValue} ${mValue.name} ${sValue}`),
                    icon: mValue.icon
                })
            }
        }
    }
}

// Create new league
async function createLeague(ref, id, guild) {
    const parent = await ref.get().then(snapshot => {
        if (snapshot.exists) {
            return Object.assign(snapshot.data(), { id: snapshot.id });
        } else
            return {}
    }).catch((e) => {
        console.log(e)
    });

    if (parent === {})
        return {}

    const data = {
        guilds: guild ? [guild] : [],
        full: false,
        icon: parent.icon,
        name: parent.name + ' ' + id,
        slug: parent.slug + '-' + id
    };

    await ref.collection("objLeagues").doc(String(id)).set(data)

    return {
        icon: data.icon,
        name: data.name,
        slug: data.slug,
        id: id,
    }
}

// Get good league pointer
async function getCurrentLeague(ref) {
    return await ref.collection("objLeagues").where("full", "==", false).get().then(snapshot => {
        if (!snapshot.empty) {
            return Object.assign(snapshot.docs[0].data(), { id: snapshot.docs[0].id });
        } else {
            return undefined;
        }
    }).catch((e) => {
        console.log(e)
    });
}

// Method to add a guild to a league for current content
async function addToLeague(guild, progress) {
    if (guild.raid_objectives && guild.raid_objectives[progress] && guild.raid_objectives[progress].slug && !(guild.leagues && guild.leagues[progress])) {
        const dbRef = db.collection("leagues").doc(progress).collection("objective").doc(String(guild.raid_objectives[progress].slug));
        const objLeague = await getCurrentLeague(dbRef);

        if (objLeague === undefined) {
            return await createLeague(dbRef, 1, guild.id)
        } else {
            const full = objLeague.guilds.push(guild.id) >= leagueSize;

            await dbRef.collection("objLeagues").doc(objLeague.id).update({
                guilds: objLeague.guilds,
                full: full
            })

            if (full)
                await createLeague(dbRef, Number(objLeague.id) + 1);

            return {
                icon: objLeague.icon,
                name: objLeague.name,
                slug: objLeague.slug,
                id: objLeague.id,
            }

        }
    } else
        return {}
}

// Daily processing of new guilds
async function dailyTally() {
    var guilds = [];
    var progress = '';

    // Get current progress
    progress = await db.collection("progress").where('status', '==', 1).get()
        .then((snapshot) => {
            if (!snapshot.empty) {
                return snapshot.docs[0].data().slug;
            }
            else return '';
        }).catch((e) => {
            console.log(e)
        });

    // Get tagged guilds
    if (progress !== '') {
        guilds = await db.collection("guilds").where('tag', '==', true).get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    guilds.push(Object.assign(doc.data(), { id: doc.id }));
                })
                return guilds;
            }).catch((e) => {
                console.log(e)
            });
    }

    // Process for each tagged guilds
    for (guild of guilds) {
        // Add to a league
        /* eslint-disable no-await-in-loop, no-loop-func */
        await addToLeague(guild, progress).then((res) => {
            // If OK (league id) update flags
            if (res && res.id) {
                db.collection("guilds").doc(guild.id).update({
                    tag: false,
                    active: true,
                    ["leagues." + progress]: res
                });

                return res;
            } else
                // If not, nothing
                return undefined;
        }).then((res) => {
            if (res)
                console.log(guild.name + ' flagged to league ' + guild.raid_objectives[progress].slug + ' ' + res.id)
            return;
        }).catch((error) => {
            throw new Error("Error updating document: " + error);
        });
        /* eslint-enable no-await-in-loop, no-loop-func */
    }
}

module.exports = {
    generateParentLeagues,
    dailyTally
}