
exports.sendClientErrorMessage = function(msg) {
    msg.channel.send('O bot tomou interdiction, aguarde um instante e tente ' +
        'novamente, fly safe CMDR!');
};

exports.sendSpecificClientErrorMessage = function(msg, errorMessage) {
    msg.channel.send(errorMessage);
};

module.exports = exports;