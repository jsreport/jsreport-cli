#!/usr/bin/env node

var path = require('path')
var packageJson = require('./package.json')

var cliInstance = require('yargs')
    .version('v', undefined, packageJson.version)
    .usage('Usage: $0 [options] <command> [options]')
    .config({
      _currentPkgVersion_: packageJson.version
    })
    .commandDir('lib/commands', {
      exclude: function (pathToCommand) {
        return /^_/.exec(path.basename(pathToCommand))
      }
    })
    .showHelpOnFail(false)
    .help('h')
    .alias('v', 'version')
    .alias('h', 'help')

var argv = cliInstance.argv

if (argv._.length === 0) {
  return cliInstance.showHelp()
}
