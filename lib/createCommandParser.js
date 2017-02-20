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
    // we are only declaring the "context" option to allow passing
    // a context object for other commands,
    // it is not mean to be used by users, that why it is hidden (description: false)
    // it needs to be global because we don't know if other command will be .strict() or not
    // and could cause validation errors
    .option('context', {
      alias: '_context_',
      description: false,
      global: true,
      type: 'string' // necessary to don't have any value if option is omitted
    })
    .epilog('To show more information about a command, type: $0 <command> -h')
  )
}
