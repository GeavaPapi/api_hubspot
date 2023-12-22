const hubspot = require('@hubspot/api-client')
const { QuickDB } = require('quick.db')
const db = new QuickDB()
const DEFAULT_LIMITER_OPTIONS = {
    minTime: 1000 / 9,
    maxConcurrent: 6,
    id: 'hubspot-client-limiter',
}

const hubspotClient = new hubspot.Client({ accessToken: "", limiterOptions: DEFAULT_LIMITER_OPTIONS })

const Discord = require('discord.js')
const client = new Discord.Client({ intents: ["GUILDS", 'MESSAGE_CONTENT', 'GUILD_MEMBERS', 'DIRECT_MESSAGES', "GUILD_MESSAGES"] })
client.login("")

client.on('ready', async () => {
    console.log('The bot is online')
    let alltickets = await hubspotClient.crm.tickets.getAll()
    // console.log(alltickets)

})

client.on('messageCreate', async (msg) => {
    msg.mentions.users.first()
})
client.on('channelCreate', async (new_channel) => {
    const regex = new RegExp('\\b' + "ticket" + '\\b');
    let category = new_channel.parent
    if (/*regex.test(new_channel.name) ||*/ category && category.name.includes("CREATED")) {
        setTimeout(() => {
            new_channel.messages.fetch({ limit: 1 }).then(async (messages) => {
                //const firstMessage = messages.first();
                //if (!firstMessage) return console.log('Couldnt fetch the first message')
                //const firstUser = firstMessage.mentions.users.first()

                const newTicket = {
                    properties: {
                        subject: `${new_channel.name}`,
                        content: `Ticket created`,
                        hs_pipeline: '0',
                        hs_pipeline_stage: '1',
                    },
                };
                await hubspotClient.crm.tickets.basicApi.create(newTicket)
                    .then(async (response) => {
                        console.log(response)
                        await db.set(`channel_${response.id}`, new_channel.id)
                        await db.set(`ticket_${new_channel.id}`, response.id)

                        console.log('Ticket creat cu succes');

                    }).catch(error => {
                        console.error('Eroare la crearea ticketului:', error);
                    });

            })
        }, 2500)
    } else {
        return
    }
})


client.on('channelUpdate', async (old_channel, new_channel) => {
    if (old_channel.parentId !== new_channel.parentId) {
        let category = new_channel.parentId
        let guild = await client.guilds.cache.get(`${new_channel.guildId}`)
        let fetch_categoryname = await guild.channels.cache.get(category)
        if (fetch_categoryname && fetch_categoryname.name.toLowerCase().includes('closed')) {
            let getticket = await db.get(`ticket_${new_channel.id}`)
            let new_properties = {
                properties: {
                    subject: `${new_channel.name}`,
                    hs_pipeline_stage: '3',
                },
            };
            await hubspotClient.crm.tickets.basicApi.update(getticket, new_properties)
        }
        if (fetch_categoryname && fetch_categoryname.name.toLowerCase().includes('claimed')) {
            let getticket = await db.get(`ticket_${new_channel.id}`)
            let new_properties = {
                properties: {
                    subject: `${new_channel.name}`,
                    hs_pipeline_stage: '2',
                },
            };
            await hubspotClient.crm.tickets.basicApi.update(getticket, new_properties)
        }

    }
    /*
    if (old_channel.name !== new_channel.name) {
        console.log(old_channel.name)
        console.log(new_channel.name)
        let getticket = await db.get(`ticket_${new_channel.id}`)
        let new_properties = {
            properties: {
                subject: `${new_channel.name}`,
                hs_pipeline_stage: '3',
            },
        };
        await hubspotClient.crm.tickets.basicApi.update(getticket, new_properties)
    }
    */
})
client.on("messageCreate", async (message) => {
    let get_ticket = await db.get(`ticket_${message.channel.id}`)
    if (!get_ticket || get_ticket === null) return
    if (get_ticket !== null && !message.author.bot) {
        const currentTimestamp = Date.now();
        const newNote = {
            properties: {
                hs_note_body: `${message.author.username} : ${message.content}`,
                hs_timestamp: currentTimestamp
            },
            associations: [
                {
                    to: {
                        id: get_ticket
                    },
                    types: [
                        {
                            associationCategory: "HUBSPOT_DEFINED",
                            associationTypeId: 228
                        }
                    ]
                }
            ]
        };

        await hubspotClient.crm.objects.notes.basicApi.create(newNote).then(response => {
            console.log('Notița a fost adăugată cu succes');
        })
            .catch(error => {
                console.error('Eroare la adăugarea notiței:', error);
            });
        let current_ticket = await hubspotClient.crm.tickets.basicApi.getById(get_ticket)
        let current_content = current_ticket.properties.content
        let new_properties = {
            properties: {
                content: `${current_content}\n${message.author.username} : ${message.content}`,
            },
        };
        await hubspotClient.crm.tickets.basicApi.update(get_ticket, new_properties)


    }
})