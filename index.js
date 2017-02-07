var spawn = require('child_process').spawn
var path = require('path')
var isWin = /^win/.test(process.platform);

module.exports = function (command, args, options) {
    if (isWin) {
        args = Object.assign([], args)
        args.unshift(command)
        return spawn(path.join(__dirname, 'WinRun.exe'), args, options)    
    } 

    return spawn(command, args, options)
}