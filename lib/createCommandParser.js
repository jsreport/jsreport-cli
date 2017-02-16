var yargs = require('yargs')
var packageJson = require('../package.json')

module.exports = function createCommandParser (instance) {
  var cli = instance || yargs([])

  return (
    cli
    .version('v', undefined, packageJson.version)
    .usage('Usage: $0 [options] <command> [options]')
    .showHelpOnFail(false)
    .help('h', false)
    .alias('v', 'version')
    .alias('h', 'help')
    .epilog('To show more information about a command, type: $0 <command> -h')
  )
}
