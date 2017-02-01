'use strict'

var initializeApp = require('./_initializeApp')

exports.command = 'init'
exports.desc = 'Initializes the current working directory to start a jsreport application (server.js, *.config.json and package.json)'

exports.builder = {}

exports.handler = function (argv) {
  initializeApp(false)
}
