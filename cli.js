#!/usr/bin/env node
var path = require('path')
var semver = require('semver')
var Liftoff = require('liftoff')
var commander = require('./lib/commander')
var init = require('./lib/commands/init')
var repair = require('./lib/commands/repair')
var configure = require('./lib/commands/configure')
var render = require('./lib/commands/render')
var cliPackageJson = require('./package.json')

var cli = new Liftoff({
  processTitle: 'jsreport',
  moduleName: 'jsreport-cli',
  configName: '.jsreport'
})

cli.launch({}, initCLI)

function initCLI (env) {
  var args = process.argv.slice(2)
  var cwd = process.cwd()
  var localCommander

  if (!env.modulePath) {
    // if no local installation is found,
    // try to detect if some global command was specified
    var globalCliHandler = commander(cwd, {
      builtInCommands: [init, repair, configure, render],
      ignoreEntryPointCommands: ['init', 'repair', 'configure', 'render']
    })

    globalCliHandler.on('started', function (err, info) {
      if (err) {
        console.error(err.message)
        return process.exit(1)
      }

      if (!info.handled) {
        if (info.mainCommand != null) {
          console.error('"' + info.mainCommand + '" command not found')
          console.error('Local jsreport-cli not found in:', env.cwd)
          console.error('Try installing jsreport-cli or jsreport package to have more commands available')

          return process.exit(1)
        }

        console.error('Local jsreport-cli not found in:', env.cwd)
        console.error('Try installing jsreport-cli or jsreport package')

        return process.exit(1)
      }

      return
    })

    globalCliHandler.start(args)
  } else {
    // Check for semver difference between global cli and local installation
    if (semver.gt(cliPackageJson.version, env.modulePackage.version)) {
      console.log('Warning: jsreport-cli version mismatch:')
      console.log('Global jsreport-cli is', cliPackageJson.version)
      console.log('Local jsreport-cli is', env.modulePackage.version)
    }

    localCommander = require(path.join(path.dirname(env.modulePath), 'lib/commander.js'))(cwd)

    // start processing
    localCommander.start(args)
  }
}
