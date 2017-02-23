'use strict'

var description = 'Starts a jsreport process in current working directory'
var command = 'start'

exports.command = command
exports.description = description

exports.configuration = {
  disableStrictOptions: true,
  disableProcessExit: true
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
