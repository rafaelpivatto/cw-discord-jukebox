const { Command } = require('discord.js-commando');
const logger = require('heroku-logger');
const ytdl = require('ytdl-core');
const YoutubeDL = require('youtube-dl');
const { RichEmbed } = require('discord.js');
const removeItems = require('remove-array-items');

const errorMessage = require('../../modules/message/errorMessage.js')

const logName = '[PlaySound]',
    embedRed = '#f00000',
    embedYellow = '#ffff00',
    embedGreen = '#00ff64',
    embedBlue = '#0064ff',
    searchParams = [
        '-q', 
        '-f bestaudio',
        '--no-warnings', 
        '--force-ipv4', 
        '--geo-bypass', 
        '--no-playlist', 
        '--hls-prefer-ffmpeg'
    ]
    streamOptions = { 
        filter : 'audioonly',
        quality: 'highestaudio' 
    },
    feedbackMessages = [
        'Mandou muito bem,',
        'Essa é muito boa,',
        'Essa entrega a idade,',
        'Quero ver todo mundo curtindo,',
        'Essa é top,',
        'Essa faz tempo que não ouço,',
        'Solta o som DJ,',
        'Estava na hora de alguém pedir essa,',
        'Essa é uma obra prima,',
        'Aumenta o som pra essa!'
    ];
let connection,
    channel,
    playlist = [],
    dispatcher,
    musicPlaying,
    maximumMusicRequests = process.env.MUSIC_MAXIMUM_USER_REQUESTS || 5;

module.exports = class PlayMusicCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'musica',
            group: 'music',
            aliases: ['música', 'music'],
            memberName: 'playmusic',
            description: 'Command to play music on channel',
            guildOnly: true,
            patterns: [new RegExp('[a-zA-Z]')]
        });
    }

    async run(msg, args) {
        const authorName = msg.member.nickname || msg.message.author.username;
        logger.info(logName + ' Execute command by user = ' + authorName + ' >>> ' + args);

        if (!checkRequirements(msg)) {
            return;
        }

        if(isAddCommands(args)) {
            const music = args.replace('add', '').trim();
            if (!music || music === '') {
                const embed = new RichEmbed()
                    .setColor(embedRed)
                    .setAuthor(authorName, getCleanUrl(msg.author))
                    .setDescription('Envie **!musica add <nome da musica>** ou ' +
                    '**!musica add <link do youtube>** para adicionar uma música à fila\n' +
                    'Se precisar de ajuda, digite **!ajudamusica**');
            
                return msg.channel.send({'embed': embed}).then(response => {
                    msg.delete();
                });
            } else {
                if (isExceededMaximumRequests(msg)) {
                    const embed = new RichEmbed()
                        .setColor(embedRed)
                        .setAuthor(authorName, getCleanUrl(msg.author))
                        .setDescription('Você já tem ' + maximumMusicRequests + ' músicas na fila.\n' +
                        'Conforme elas forem tocando você poderá adicionar outras ;) aproveite o som comandante!\n' +
                        'Se precisar de ajuda, digite **!ajudamusica**');
                
                    return msg.channel.send({'embed': embed}).then(response => {
                        msg.delete();
                    });
                }
                searchSong(msg, music)
            }
        } else if(isModeratorCommands(args)) {
            if (isModeratorUser(msg)) {
                setControllCommand(args, msg);
            } else {
                logger.info(logName + ' user dont have permission');
                const embed = new RichEmbed()
                    .setColor(embedRed)
                    .setAuthor(authorName, getCleanUrl(msg.author))
                    .setDescription('Você não tem permissão para executar esse comando, solicite a algum moderador.');
        
                return msg.channel.send({'embed': embed}).then(response => {
                    msg.delete();
                });
            }
        } else if(isCommunityCommand(args)) {
            setControllCommand(args, msg);
        } else {
            const embed = new RichEmbed()
                .setColor(embedRed)
                .setAuthor(authorName, getCleanUrl(msg.author))
                .setDescription('Comando "' + args + '" inválido, se precisar de ajuda !ajudamusica');

            return msg.channel.send({'embed': embed}).then(response => {
                msg.delete();
            });
        }
        
        //--- Functions ---
        function searchSong(msg, music) {
            let searchstring = music;
            let musicLink = music;
            if (music.toLowerCase().startsWith('http')) {
                musicLink = '<' + music + '>'
            } else {
                searchstring = 'ytsearch:' + music + ' Official Audio';
            }

            // Get the video information.
            logger.info(logName + ' Searching for: ' + searchstring);
            let embedSearch = new RichEmbed()
                .setColor(embedRed)
                .setAuthor(authorName, getCleanUrl(msg.author))
                .setThumbnail('https://i.imgur.com/vcW4iNm.png')
                .setDescription('Aguarde um instante, pesquisando por **"'+ musicLink + '"**...');
            
            msg.channel.send({'embed': embedSearch}).then(response => {
                msg.delete();
                YoutubeDL.getInfo(searchstring, searchParams, {maxBuffer: 'Infinity'}, (err, info) => {
                    // Verify the info.
                    if (err || info.format_id === undefined || info.format_id.startsWith('0')) {
                        if (err) {
                            logger.error('Error: ', err);
                        }
                        if (info) {
                            logger.error('Info: ', info);
                        }
                        response.delete();
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setAuthor(authorName, getCleanUrl(msg.author))
                            .setDescription('Houve um erro ao pesquisar a musica :(\n'
                            + '__Talvez__ a música não pode ser reproduzida fora do youtube.\n'
                            + 'Tente novamente ou adicione a música por outro link do youtube ;)');
                        return msg.channel.send({'embed': embed});
                    }
                    
                    logger.info(logName + ' Search finished');

                    info.requester = {
                        id: msg.author.id,
                        avatarURL: msg.author.avatarURL,
                        defaultAvatarURL: msg.author.defaultAvatarURL,
                        nickname: authorName
                    };

                    // Queue the video.
                    let embed = new RichEmbed()
                        .setColor(embedRed)
                        .setTimestamp()
                        .setAuthor(info.requester.nickname, getCleanUrl(msg.author))
                        .setThumbnail(info.thumbnail)
                        .setFooter('Listen safe, cmdr!')
                        .setDescription('Adicionado à fila...'+ 
                            '\nMúsica: **' + info.title + '**' +
                            '\nDuração: **' + getDuration(info) + '**' +
                            '\nPosição: **' + (parseInt(playlist.length) + 1) + '**' +
                            '\n[Link da musica](' + info.webpage_url + ')');

                    playlist.push(info);
                    response.delete();
                    msg.channel.send({'embed': embed}).then(() => {
                        logger.info(logName + ' Adicionado à fila ' + info.title + ', duração: ' + getDuration(info));
                        
                        // Play if only one element in the playlist.
                        if (playlist.length === 1) executePlaylist(msg, playlist);
                    }).catch(console.log);
                });
            }).catch(console.error);
        }

        function executePlaylist(msg, playlist) {
            // If the playlist is empty, finish.
            if (playlist.length === 0) {
                connection = null;
                channel.leave();
                let embedEndOfPlaylist = new RichEmbed()
                    .setColor(embedBlue)
                    .setThumbnail('https://i.imgur.com/7JwvMMy.png')
                    .setDescription('Fim da fila, não deixe o som parar, adicione mais músicas...' +
                        '\nSe precisar de ajuda use o comando: __!ajudamusica__');
                return msg.channel.send({'embed': embedEndOfPlaylist});
            }

            // Get the first item in the queue.
            const music = playlist[0];
            
            let embedSearch = new RichEmbed()
                .setColor(embedGreen)
                .setThumbnail('https://i.imgur.com/TqS03tb.png')
                .setDescription('Trocando o disco, a próxima musica já vai começar...');
            msg.channel.send({'embed': embedSearch}).then(response => {
                
                getConnection(function(error){

                    if (error) {
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setDescription('Houve um erro inesperado, por favor avise algum admin-bot\n\n' +
                            'Código: get connection => ' + error);
                        return msg.channel.send({'embed': embed});
                    }

                    const stream = ytdl(music.webpage_url, music.is_live ? {} : streamOptions);
                    dispatcher = connection.playStream(stream, { volume: 0.1, passes: 2, bitrate: 'auto'});
                    musicPlaying = music;
                    
                    logger.info(logName + ' Tocando a música ' + music.title + ', duração: ' + getDuration(music));
                    const songsRemaining = playlist.length-1;
                    let next = '\nDepois dessa... ';
                    if (songsRemaining === 1) {
                        next += 'mais 1 música na fila.'; 
                    } else if (songsRemaining > 1) {
                        next += String(songsRemaining) + ' músicas na fila.'; 
                    } else{
                        next += 'a fila não tem mais músicas.';
                    }
                    
                    let textLive = '';
                    if (music.is_live) {
                        textLive += '\n*Essa música só termina quando finalizar a live ou quando executar o comando !musica proxima.*'
                    }

                    const embed = new RichEmbed()
                        .setColor(embedGreen)
                        .setTimestamp()
                        .setAuthor(music.requester.nickname + ' adicionou essa...', getCleanUrl(music.requester))
                        .setThumbnail(music.thumbnail)
                        .setFooter('Listen safe, cmdr!')
                        .setDescription(feedbackMessages[Math.floor(Math.random() * 10)] + ' tocando agora...' +
                            '\nMúsica: **' + music.title + '**' +
                            '\nDuração: **' + getDuration(music) + '**' + textLive +
                            '\n[Link da musica](' + music.webpage_url + ')' +
                            next);
    
                    dispatcher.on('start', () => {
                        connection.player.streamingData.pausedTime = 0;
                        response.delete();
                        msg.channel.send({'embed': embed});
                    });
                    
                    connection.on('error', (error) => {
                        // Skip to the next song.
                        logger.error(logName + ' ' + error);
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setDescription('Houve um erro inesperado, por favor avise algum admin-bot\n\n' +
                            'Código: connection => ' + error);
                        msg.channel.send({'embed': embed});
                        playlist.shift();
                        stream.end();
                        executePlaylist(msg, playlist);
                    });
                    
                    dispatcher.on('error', (error) => {
                        stream.end();
                        // Skip to the next song.
                        logger.error(logName + ' ' + error);
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setDescription('Houve um erro no discord ao tocar essa música :(\n\nTente novamente.');
                        msg.channel.send({'embed': embed});
                        playlist.shift();
                        executePlaylist(msg, playlist);                    
                    });
    
                    dispatcher.on('end', () => {
                        stream.end();
                        logger.info(logName + ' fim da música.');
                        // Wait a second.
                        setTimeout(() => {
                            if (playlist.length > 0) {
                                // Remove the song from the playlist.
                                removeItems(playlist, 0, 1);
                                // Play the next song in the playlist.
                                executePlaylist(msg, playlist);
                            }
                        }, 1000);
                    });
                });
            }).catch(console.log);
        }

        function getConnection(callback) {
            if (!connection || !channel) {
                logger.info(logName + ' Getting a connection and connect to channel');
                channel = msg.client.channels.find('name', process.env.MUSIC_SOUND_CHANNEL);
                if (channel && channel.type === 'voice') {
                    channel.join().then(conn => {
                        connection = conn;
                        callback();
                    }).catch(err => {
                        logger.error('Erro ao conectar na sala de musica: ' + err);
                        callback('error, ' + err);
                    });
                } else {
                    callback('error, channel.type=' + channel.type);
                }
            } else {
                callback();
            }
            
        }

        function isAddCommands(args) {
            return args.indexOf('add') >= 0;
        }

        function isModeratorCommands(args) {
            const controlls = ['parar','pausar', 'continuar'];
            return controlls.includes(getCommandWithoutParam(args)[0]);
        }

        function isCommunityCommand(args) {
            const controlls = ['remover', 'proxima','fila', 'lista', 'vol+','vol-'];
            return controlls.includes(getCommandWithoutParam(args)[0]);
        }

        function isModeratorUser(msg) {
            if (process.env.MUSIC_ADMIN_ROLE) {
                return msg.member.roles.find('name', process.env.MUSIC_ADMIN_ROLE);
            }
            return false;
        }

        function isUserRequestMusic(msg, musicNumber) {
            return playlist[musicNumber-1] && playlist[musicNumber-1].requester.id === msg.author.id;
        }

        function isExceededMaximumRequests(msg) {
            if (isModeratorUser(msg)) return false;

            const userId = msg.author.id;
            const userMusics = playlist.filter(x => x.requester.id === userId).length;

            return userMusics >= maximumMusicRequests;
        }

        function setControllCommand(args, msg) {
            const authorName = msg.member.nickname || msg.message.author.username;
            const command = getCommandWithoutParam(args);
            switch (command[0]) {
                case 'proxima':
                    msg.delete();
                    if (isModeratorUser(msg) || isUserRequestMusic(msg, 1)) {
                        if (connection && connection.paused) dispatcher.resume();
                        if (dispatcher) dispatcher.end();
                    } else {
                        return msg.channel.send({'embed': new RichEmbed()
                            .setColor(embedYellow)
                            .setTimestamp()
                            .setAuthor(authorName, getCleanUrl(msg.author))
                            .setFooter('Listen safe, cmdr!')
                            .setDescription('Você só pode passar músicas que você adicionou à fila ou se tiver permissão de moderador.')}).then(response => {
                                response.delete(5000);
                            });
                    }
                    break;

                case 'remover':
                    msg.delete();
                    const numberToRemove = Number(command[1]);
                    if (command[1] && !isNaN(numberToRemove)) {
                        if (numberToRemove <= 0 || numberToRemove > playlist.length) {
                            return msg.channel.send({'embed': new RichEmbed()
                                .setColor(embedYellow)
                                .setTimestamp()
                                .setAuthor(authorName, getCleanUrl(msg.author))
                                .setFooter('Listen safe, cmdr!')
                                .setDescription('O número da música informado é inválido.')}).then(response => {
                                    response.delete(5000);
                                });
                        } else {
                            if (isModeratorUser(msg) || isUserRequestMusic(msg, numberToRemove)) {
                                if (numberToRemove === 1){
                                    if (connection && connection.paused) dispatcher.resume();
                                    if (dispatcher) dispatcher.end();
                                } else {
                                    removeItems(playlist, numberToRemove-1, 1);
                                    return msg.channel.send({'embed': new RichEmbed()
                                        .setColor(embedYellow)
                                        .setTimestamp()
                                        .setAuthor(authorName + ' removeu...', getCleanUrl(msg.author))
                                        .setFooter('Listen safe, cmdr!')
                                        .setDescription('A música da posição #' + numberToRemove + ' foi removida.')});
                                }
                            } else {
                                return msg.channel.send({'embed': new RichEmbed()
                                    .setColor(embedYellow)
                                    .setTimestamp()
                                    .setAuthor(authorName, getCleanUrl(msg.author))
                                    .setFooter('Listen safe, cmdr!')
                                    .setDescription('Você só pode remover músicas que você adicionou à fila ou se tiver permissão de moderador.')}).then(response => {
                                        response.delete(5000);
                                    });
                            }
                        }
                    } else {
                        return msg.channel.send({'embed': new RichEmbed()
                            .setColor(embedYellow)
                            .setTimestamp()
                            .setAuthor(authorName, getCleanUrl(msg.author))
                            .setFooter('Listen safe, cmdr!')
                            .setDescription('Você deve informar o número da musica na fila que deseja remover. ex: !musica remover 2')}).then(response => {
                                response.delete(5000);
                            });
                    }
                    break;

                case 'parar':
                    if (playlist.length > 0) {
                        const authorName = msg.member.nickname || msg.message.author.username;
                        let message = '';
                        if (playlist.length === 1) {
                            message = '1 música foi removida da fila';
                        } else {
                            message = playlist.length + ' músicas foram removidas da fila.';
                        }
                        const embed = new RichEmbed()
                            .setColor(embedYellow)
                            .setTimestamp()
                            .setAuthor(authorName + ' removeu...', getCleanUrl(msg.author))
                            .setFooter('Listen safe, cmdr!')
                            .setDescription('Ok, a fila foi parada... ' + message);
                        msg.channel.send({'embed': embed});
                        msg.delete();
                    }
                    removeItems(playlist, 0, playlist.length);
                    if (connection && connection.paused) dispatcher.resume();
                    if (dispatcher) dispatcher.end();
                    if (channel) channel.leave();
                    break;

                case 'pausar':
                    if (dispatcher) {
                        dispatcher.pause();
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setAuthor(authorName, getCleanUrl(msg.author))
                            .setDescription('Música pausada...\n' +
                                'Para continuar, digite: !musica continuar');
                    
                        msg.channel.send({'embed': embed}).then(response => {
                            msg.delete();
                        });
                    }
                    break;

                case 'continuar':
                    if (dispatcher) {
                        dispatcher.resume();
                        const embed = new RichEmbed()
                            .setColor(embedRed)
                            .setAuthor(authorName, getCleanUrl(msg.author))
                            .setDescription('Continuando a música...');
                    
                        msg.channel.send({'embed': embed}).then(response => {
                            msg.delete();
                            response.delete(5000);
                        });
                    }
                    break;

                case 'vol+':
                    if (dispatcher) {
                        msg.delete();
                        if (Number(dispatcher.volume).toFixed(1) < 1) {
                            
                            const val = dispatcher.volume+0.1;
                            dispatcher.setVolume(val);
                            const embed = new RichEmbed()
                                .setColor(embedRed)
                                .setAuthor(authorName, getCleanUrl(msg.author))
                                .setDescription('Volume aumentado para ' + String(val*100).substring(0, 2) + '%');
                            msg.channel.send({'embed': embed}).then(response => {
                                response.delete(3000);
                            });
                        }
                    }
                    break;

                case 'vol-':
                    if (dispatcher) {
                        msg.delete();
                        if (Number(dispatcher.volume).toFixed(1) > 0.1) {
                            const val = dispatcher.volume-0.1;
                            dispatcher.setVolume(val);
                            const embed = new RichEmbed()
                                .setColor(embedRed)
                                .setAuthor(authorName, getCleanUrl(msg.author))
                                .setDescription('Volume diminuído para ' + String(val*100).substring(0, 2) + '%');
                            msg.channel.send({'embed': embed}).then(response => {
                                response.delete(3000);
                            });
                        }
                    }
                    break;

                case 'lista':
                case 'fila':
                    getPlaylist(msg);
                    break;
            }
        }

        function getCommandWithoutParam(args) {
            if (args.indexOf(' ') > 0) {
                return args.split(' ');
            } else {
                return [args]
            }
        }

        function getCleanUrl(member) {
            if (member.avatarURL) {
                const index = member.avatarURL.indexOf('?');
                if (index > 0) {
                    return member.avatarURL.substring(0, index);
                }
            } else {
                return member.defaultAvatarURL;
            }
        }

        function getDuration(music) {
            if (music.is_live) {
                return '∞ - live ao vivo ;P';
            } else {
                return music._duration_hms
            }
        }

        function getPlaylist(msg) {
            if (playlist.length > 0) {
                let desc = '';
                for (let i=0; i<playlist.length && i<10; i++) {
                    if (i===0) {
                        desc += ':radio: ';
                        desc += '**Tocando agora:**\n\n';
                        desc += '**#' + (Number(i)+1) + ' - [' + playlist[i].title + '](' + playlist[i].webpage_url + ')**\n';
                        desc += '\t\t**Duração: ' + getDuration(playlist[i]) + ' - por: ' + playlist[i].requester.nickname + '**';
                        if (playlist[i].is_live) {
                            desc += '\n\t\t*Essa música só termina quando finalizar a live ou quando executar o comando !musica proxima.*'
                        }
                        desc += '\n\n\n';
                    } else {
                        if (i===1) {
                            desc += ':track_next: **Próximas músicas na fila:**\n\n';
                        }
                        desc += '**#' + (Number(i)+1) + ' - ** [' + playlist[i].title + '](' + playlist[i].webpage_url + ')\n';
                        desc += '\t\tDuração: ' + getDuration(playlist[i]) + ' - por: ' + playlist[i].requester.nickname;
                        if (playlist[i].is_live) {
                            desc += '\n\t\t*Essa música só termina quando finalizar a live ou quando executar o comando !musica proxima.*'
                        }
                        desc += '\n\n';
                    }
                }
                if (playlist.length > 10) {
                    desc += 'Exibindo: 10/'+playlist.length;
                }
                const embed = new RichEmbed()
                    .setColor(embedRed)
                    .setAuthor(authorName, getCleanUrl(msg.author))
                    .setFooter('Listen safe, cmdr!')
                    .setTimestamp()
                    .setTitle('Fila de músicas')
                    .setThumbnail('https://i.imgur.com/2j485bH.png')
                    .setDescription(desc);
            
                return msg.channel.send({'embed': embed}).then(response => {
                    msg.delete();
                });
            } else {
                return msg.channel.send('A fila está vazia.');
            }
        }

        function checkRequirements(msg) {
            const textChannelAuthorized = process.env.MUSIC_TEXT_CHANNEL;
            const voiceChannelAuthorized = process.env.MUSIC_SOUND_CHANNEL;
            const userTextChannelCommand = msg.message.channel.name;
            const userVoiceChannelConnected = msg.message.member.voiceChannel;
    
            if (!textChannelAuthorized || !voiceChannelAuthorized) {
                msg.delete();
                errorMessage.sendSpecificClientErrorMessage(msg, 
                    'Desculpe, o comando de música está temporariamente desabilitado.', null, 5000);
                logger.info(logName + ' command disabled');        
                return false;
            }
    
            if (textChannelAuthorized !== userTextChannelCommand) {
                msg.delete();
                errorMessage.sendSpecificClientErrorMessage(msg, 
                    'Por favor, execute os comandos de música na sala **<#' + 
                    msg.client.channels.find('name', textChannelAuthorized).id + '>**', null, 5000);
                logger.info(logName + ' command executed out of channel');
                return false;
            }
            
            if (!isModeratorUser(msg) && (!userVoiceChannelConnected || voiceChannelAuthorized !== userVoiceChannelConnected.name)) {
                msg.delete();
                errorMessage.sendSpecificClientErrorMessage(msg, 
                    'Você precisa estar na sala de aúdio **' + voiceChannelAuthorized + 
                    '** para executar os comandos de música.', null, 5000);
                logger.info(logName + ' user not in sound channel');
                return false;
            }
            return true;
        }
    }    
}    