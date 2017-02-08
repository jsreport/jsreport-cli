'use strict'

var initializeApp = require('./_initializeApp')

var description = 'Initializes the current working directory to start a jsreport application (server.js, *.config.json and package.json)'
var command = 'init'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  return (
    yargs
    .usage(description + '\nUsage: $0 ' + command)
    .check(function (argv, hash) {
      if (argv.serverUrl) {
        throw new Error('serverUrl option is not supported in this command')
      }

      return true
    }).fail(function (msg, err) {
      console.error(command + ' command error:')
      console.error(msg)
      process.exit(1)
    })
  )
}

exports.handler = function (argv) {
  initializeApp(false)
}
