var yargs = require('yargs')
var packageJson = require('../package.json')

module.exports = function createCommandParser (commands) {
  var cli = (
    yargs
    .version('v', undefined, packageJson.version)
    .usage('Usage: $0 [options] <command> [options]')
    .showHelpOnFail(false)
    .help('h', false)
    .alias('v', 'version')
    .alias('h', 'help')
    .epilog('To show more information about a command, type: $0 <command> -h')
  )

  if (!Array.isArray(commands)) {
    return cli
  }

  commands.forEach(function (cmd) {
    cli.command(cmd)
  })

  return cli
}
