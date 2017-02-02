'use strict'

var initializeApp = require('./_initializeApp')

var description = 'Initializes the current working directory to start a jsreport application (server.js, *.config.json and package.json)'
var command = 'init'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  return yargs.usage(description + '\nUsage: $0 ' + command)
}

exports.handler = function (argv) {
  initializeApp(false)
}
