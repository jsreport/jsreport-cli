'use strict'

var initializeApp = require('./_initializeApp')

var description = 'Initializes the current working directory to start a jsreport application (server.js, *.config.json and package.json)'
var command = 'init'

exports.command = command
exports.description = description

exports.handler = function (argv) {
  var cwd = argv.context.cwd

  return initializeApp(cwd, false)
}
