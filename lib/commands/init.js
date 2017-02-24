'use strict'

var initializeApp = require('./_initializeApp')

var description = 'Initializes the current working directory to start a jsreport application (server.js, *.config.json and package.json)'
var command = 'init'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  return (
    yargs.usage([
      description + '\n',
      'Usage: jsreport ' + command + ' [versionToInstall]\n',
      'If no jsreport installation was found we will try to install the version of',
      'jsreport specified in `versionToInstall` and if it is not specified we will try to install the latest version'
    ].join('\n'))
  )
}

exports.handler = function (argv) {
  var cwd = argv.context.cwd
  var versionToInstall

  if (argv._ && argv._[1]) {
    versionToInstall = argv._[1]
  }

  return initializeApp(cwd, false, versionToInstall)
}
