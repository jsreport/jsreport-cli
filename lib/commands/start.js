'use strict'

var description = 'Starts a jsreport process in current working directory'
var command = 'start'

exports.command = command
exports.description = description

exports.configuration = {
  disableStrictOptions: true,
  disableProcessExit: true
}

exports.builder = function (yargs) {
  return (
    yargs.usage([
      description + '\n',
      'Usage: jsreport ' + command + '\n',
      'You can set any jsreport configuration option using arguments or env vars',
      'For example, to set httpPort option using arguments:\n',
      'simple option:',
      '   jsreport start --httpPort=9000\n',
      'nested option:',
      '   jsreport start --connectionString:name=fs\n',
      'Or using env vars:\n',
      '    Linux/macOS:',
      '       simple option:',
      '           $> env httpPort=9000 jsreport start\n',
      '       nested option:',
      '           $> env connectionString:name=9000 jsreport start\n',
      '    Windows:',
      '       simple option:',
      '           $> set httpPort=9000',
      '           $> jsreport start\n',
      '       nested option:',
      '           $> set connectionString:name=9000',
      '           $> jsreport start\n\n',
      'Also, you can put configuration in dev.config.json or prod.config.json,',
      'these files will be read based on the value of env var NODE_ENV,',
      'if this env var is not set, "development" will be the default value and dev.config.json file will be load\n',
      'You can learn more about jsreport configuration and available options here: https://jsreport.net/learn/configuration'
    ].join('\n'))
  )
}

exports.handler = function (argv) {
  var verbose = argv.verbose
  var context = argv.context
  var cwd = context.cwd
  var getInstance = context.getInstance
  var initInstance = context.initInstance

  if (verbose) {
    console.log('resolving jsreport location..')
  }

  return (
    getInstance(cwd)
    .then(function (jsreportInstance) {
      if (verbose) {
        console.log('starting jsreport..')
      }

      // init and resolving the promise with the instance
      return initInstance(jsreportInstance, true)
    }).then(function (result) {
      if (verbose) {
        console.log('jsreport successfully started')
      }

      return result
    })
  )
}
