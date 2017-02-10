#!/usr/bin/env node

var path = require('path')
var semver = require('semver')
var Liftoff = require('liftoff')
var createCommandParser = require('./lib/createCommandParser')
var init = require('./lib/commands/init')
var repair = require('./lib/commands/repair')
var cliPackageJson = require('./package.json')

var COMMANDS_AVAILABLE_GLOBALLY = ['init', 'repair']

var cli = new Liftoff({
  processTitle: 'jsreport',
  moduleName: 'jsreport-cli',
  configName: '.jsreport'
})

cli.launch({}, initCLI)

function initCLI (env) {
  var parseCommands

  if (!env.modulePath) {
    // if no local installation is found,
    // try to detect if some global command was specified
    var globalCliHandler = (
      createCommandParser([init, repair])
      .argv
    )

    if (globalCliHandler._.length > 0) {
      if (COMMANDS_AVAILABLE_GLOBALLY.indexOf(globalCliHandler._[0]) !== -1) {
        return
      }
    }

    console.error('Local jsreport-cli not found in:', env.cwd)
    console.error('Try installing jsreport-cli or jsreport package')

    return process.exit(1)
  }

  // Check for semver difference between global cli and local installation
  if (semver.gt(cliPackageJson.version, env.modulePackage.version)) {
    console.log('Warning: jsreport-cli version mismatch:')
    console.log('Global jsreport-cli is', cliPackageJson.version)
    console.log('Local jsreport-cli is', env.modulePackage.version)
  }

  parseCommands = require(path.join(path.dirname(env.modulePath), 'lib/parseCommands.js'))

  // start parsing
  parseCommands(process.argv.slice(2), process.cwd())
}
