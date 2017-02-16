'use strict'

var initializeApp = require('./_initializeApp')

var description = 'Repairs current working directory to start a jsreport application (server.js, *.config.json and package.json)'
var command = 'repair'

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
    })
  )
}

exports.handler = function (argv) {
  var cwd = argv.context.cwd

  return initializeApp(cwd, true)
}
