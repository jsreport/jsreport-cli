'use strict'

const description = 'Starts a jsreport process in current working directory'
const command = 'start'

exports.command = command
exports.description = description

exports.configuration = {
  disableStrictOptions: true,
  disableProcessExit: true
}

exports.builder = (yargs) => {
  return (
    yargs.usage([
      `${description}\n`,
      `Usage: jsreport ${command}\n`,
      'You can set any jsreport configuration option using arguments or env vars',
      'For example, to set httpPort option using arguments:\n',
      'simple option:',
      '   jsreport start --httpPort=9000\n',
      'nested option:',
      '   jsreport start --store:provider=fs\n',
      'Or using env vars:\n',
      '    Linux/macOS:',
      '       simple option:',
      '           $> env httpPort=9000 jsreport start\n',
      '       nested option:',
      '           $> env store:provider=fs jsreport start\n',
      '    Windows:',
      '       simple option:',
      '           $> set httpPort=9000',
      '           $> jsreport start\n',
      '       nested option:',
      '           $> set store:provider=fs',
      '           $> jsreport start\n\n',
      'Also, you can put configuration in jsreport.config.json,',
      'You can learn more about jsreport configuration, conditional config files and available options here: https://jsreport.net/learn/configuration'
    ].join('\n'))
  )
}

exports.handler = (argv) => {
  const verbose = argv.verbose
  const context = argv.context
  const cwd = context.cwd
  const getInstance = context.getInstance
  const initInstance = context.initInstance

  if (verbose) {
    console.log('resolving jsreport location..')
  }

  return (
    getInstance(cwd)
      .then((_instance) => {
        let jsreportInstance

        if (verbose) {
          console.log('starting jsreport..')
        }

        if (typeof _instance === 'function') {
          jsreportInstance = _instance()
        } else {
          jsreportInstance = _instance
        }

        // init and resolving the promise with the instance
        return initInstance(jsreportInstance, true)
      }).then((result) => {
        if (verbose) {
          console.log('jsreport successfully started')
        }

        return result
      })
  )
}
