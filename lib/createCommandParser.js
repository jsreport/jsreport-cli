var yargs = require('yargs')

module.exports = function createCommandParser (instance) {
  var cli = instance || yargs([])
  var commandHelp = 'To show more information about a command, type: jsreport <command> -h'

  return (
    cli
    .usage('Usage: jsreport [options] <command> [options]\n\n' + commandHelp)
    .showHelpOnFail(false)
    .help('help', false)
    .alias('help', 'h')
    // adding version option explicitly because we have a custom handler for it
    .option('version', {
      alias: 'v',
      description: 'Show version number',
      type: 'boolean'
    })
    // we are only declaring the "context" option to allow passing
    // a context object for other commands,
    // it is not mean to be used by users, that why it is hidden (description: false)
    // it needs to be global because we don't know if other command will be .strict() or not
    // and could cause validation errors
    .option('context', {
      alias: '_context_',
      description: false, // makes the option invisible
      type: 'string' // necessary to don't have any value if option is omitted
    })
    .epilog(commandHelp)
  )
}
