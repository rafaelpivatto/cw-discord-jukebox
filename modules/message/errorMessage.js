const { RichEmbed } = require('discord.js');

exports.sendClientErrorMessage = function(msg) {
    msg.channel.send({'embed': new RichEmbed()
        .setColor('#f00000')
        .setTimestamp()
        .setAuthor(exports.getUserNickName(msg), exports.getUserAvatar(msg))
        .setDescription('O bot tomou interdiction, aguarde um instante e tente ' +
            'novamente, fly safe CMDR!')});
};

exports.sendSpecificClientErrorMessage = function(msg, errorMessage, thumbnail, timeout) {
    let thumb = 'https://i.imgur.com/JYY3pCv.png';
    if (thumbnail) {
        thumb = thumbnail;
    }
    msg.channel.send({'embed': new RichEmbed()
        .setColor('#f00000')
        .setTimestamp()
        .setThumbnail(thumb)
        .setAuthor(exports.getUserNickName(msg), exports.getUserAvatar(msg))
        .setDescription(errorMessage)}).then(response => {
            if (timeout) {
                response.delete(timeout);
            }
        });
};

exports.getUserNickName = function(msg) {
    if (msg.member && msg.member.nickname) {
        return msg.member.nickname;
    } else if (msg.message && msg.message.author && msg.message.author.username) {
        return msg.message.author.username;
    } else if (msg.author && msg.author.username) {
        return msg.author.username;
    } else {
        return 'user';
    }
}

exports.getUserAvatar = function(msg) {
    if (msg.author.avatarURL) {
        const index = msg.author.avatarURL.indexOf('?');
        if (index > 0) {
            return msg.author.avatarURL.substring(0, index);
        }
    } else {
        return msg.author.defaultAvatarURL;
    }
}

module.exports = exports;