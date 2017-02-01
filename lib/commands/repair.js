'use strict'

var initializeApp = require('./_initializeApp')

exports.command = 'repair'
exports.desc = 'Repairs current working directory to start a jsreport application (server.js, *.config.json and package.json)'

exports.builder = {}

exports.handler = function (argv) {
  initializeApp(true)
}
