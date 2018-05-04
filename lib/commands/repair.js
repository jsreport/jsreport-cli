'use strict'

const initializeApp = require('./_initializeApp')

const description = 'Repairs current working directory to start a jsreport application (server.js, *.config.json and package.json)'
const command = 'repair'

exports.command = command
exports.description = description

exports.builder = (yargs) => {
  return (
    yargs.usage([
      `${description}\n`,
      `Usage: jsreport ${command} [versionToInstall]\n`,
      'If no jsreport installation was found we will try to install the version of',
      'jsreport specified in `versionToInstall` and if it is not specified we will try to install the latest version'
    ].join('\n'))
  )
}

exports.handler = (argv) => {
  const cwd = argv.context.cwd
  let versionToInstall

  if (argv._ && argv._[1]) {
    versionToInstall = argv._[1]
  }

  return initializeApp(cwd, true, versionToInstall)
}
