require('dotenv').config();
require('discord.js');

const express = require('express');
const Commando = require('discord.js-commando');
const logger = require('heroku-logger');

const logName = '[Index]';
const app = express();

const client = new Commando.Client({
    unknownCommandResponse: false,
});

logger.info(logName + ' =========>Initializing bot');

client.registry.registerGroup('music');
client.registry.registerCommandsIn(__dirname + '/commands');

client.login(process.env.BOT_KEY);

var server = app.listen(process.env.PORT || 5000, function () {
    var host = server.address().address;
    var port = server.address().port;
    logger.info('Server listening at ' + host + ':' + port);
});

app.all('/', function (req, res) {
    res.status(200).send('Ok!');
});

client.on('ready', (arg) => {
    setTimeout(() => {
        logger.info(logName + ' =========> Bot started');
    }, 3000);
});
