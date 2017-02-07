#!/usr/bin/env node

var path = require('path')
var semver = require('semver')
var Liftoff = require('liftoff')
var cliPackageJson = require('./package.json')

var cli = new Liftoff({
  processTitle: 'jsreport',
  moduleName: 'jsreport-cli',
  configName: '.jsreport'
})

cli.launch({}, initCLI)


function initCLI (env) {
  var parseCommands

  if (!env.modulePath) {
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
  parseCommands(process.argv.slice(2))
}
