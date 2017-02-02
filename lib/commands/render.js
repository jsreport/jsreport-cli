'use strict'

var description = 'Invoke a rendering process'
var command = 'render'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  var commandOptions = {
    template: {
      alias: 't',
      description: 'Specifies a path to a json file containing options for template input or you can specify singular options doing --template.[option_name] value',
      requiresArg: true
    },
    out: {
      alias: 'o',
      description: 'Save rendering result into a file path',
      type: 'string',
      demandOption: true,
      requiresArg: true
    }
  }

  var options = Object.keys(commandOptions)

  return (
    yargs
    .usage(description + '\nUsage: $0 ' + command + ' --out <file>')
    .group(options, 'Command options:')
    .options(commandOptions)
    .strict()
  )
}

exports.handler = function (argv) {
  console.log('render command here..', argv)
}
