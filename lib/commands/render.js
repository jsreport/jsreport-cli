'use strict'

var path = require('path')
var fs = require('fs')
var pathIsAbsolute = require('path-is-absolute')

var description = 'Invoke a rendering process'
var command = 'render'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  var commandOptions = {
    request: {
      alias: 'r',
      description: 'Specifies a path to a json file containing option for the entire rendering request',
      requiresArg: true,
      coerce: function (value) {
        return normalizePathOption('request', value, { json: true, strict: true })
      }
    },
    template: {
      alias: 't',
      description: 'Specifies a path to a json file containing options for template input or you can specify singular options doing --template.[option_name] value',
      requiresArg: true,
      coerce: function (value) {
        if (typeof value !== 'string') {
          if (value.content != null) {
            value.content = normalizePathOption('template.content', value.content, { strict: true })
          }

          if (value.helpers != null) {
            value.helpers = normalizePathOption('template.helpers', value.helpers, { strict: true })
          }

          return value
        }

        return normalizePathOption('template', value, { json: true, strict: true })
      }
    },
    data: {
      alias: 'd',
      description: 'Specifies a path to a json file containing options for data input',
      requiresArg: true,
      coerce: function (value) {
        return normalizePathOption('data', value, { json: true, strict: false })
      }
    },
    out: {
      alias: 'o',
      description: 'Save rendering result into a file path',
      type: 'string',
      demandOption: true,
      requiresArg: true,
      coerce: function (value) {
        return normalizePathOption('out', value, { read: false, strict: true })
      }
    }
  }

  var options = Object.keys(commandOptions)

  var examples = getExamples('$0 ' + command)

  examples.forEach(function (examp) {
    yargs.example(examp[0], examp[1])
  })

  return (
    yargs
    .usage(description + '\n' + getUsage('$0 ' + command))
    .group(options, 'Command options:')
    .options(commandOptions)
    .check(function (argv, hash) {
      if (!argv.request && !argv.template) {
        throw new Error('render command need at least --request or --template option')
      }

      return true
    })
    .fail(function (msg, err) {
      console.error(command + ' command error:')
      console.error(msg)
      process.exit(1)
    })
    .strict()
  )
}

exports.handler = function (argv) {
  var request = argv.request
  var template = argv.template
  var data = argv.data
  var output = argv.out
  var jsreportInstance = argv.jsreport
  var verbose = argv.verbose
  var renderingOpts = {}

  console.log('starting rendering process..')

  if (verbose) {
    console.log('Output configured to:', output)
  }

  if (request) {
    renderingOpts = request

    return startRender(jsreportInstance, {
      verbose: verbose,
      request: renderingOpts,
      output: output
    })
  }

  if (template) {
    renderingOpts.template = template
  }

  if (data) {
    renderingOpts.data = data
  }

  return startRender(jsreportInstance, {
    verbose: verbose,
    request: renderingOpts,
    output: output
  })
}

function startRender (jsreportInstance, options) {
  var request = options.request
  var output = options.output
  var verbose = options.verbose

  if (verbose) {
    console.log('rendering with options:')
    console.log(JSON.stringify(request, null, 2))
  }

  return jsreportInstance.render(request).then(function (out) {
    var outputStream = fs.createWriteStream(output)

    outputStream.on('finish', function () {
      console.log('rendering has finished successfully and saved in:', output)
      process.exit(0)
    })

    outputStream.on('error', onRenderingError)

    out.stream.pipe(outputStream)
  }).catch(onRenderingError)
}

function onRenderingError (error) {
  console.error('rendering has finished with errors:')
  console.error(error)
  process.exit(1)
}

function normalizePathOption (optionName, value, options) {
  var pathVal
  var json = options.json
  var strict = options.strict
  var read = options.read != null ? options.read : true

  if (typeof value === 'string') {
    pathVal = path.resolve(process.cwd(), value)

    if (strict) {
      if (!pathIsAbsolute(pathVal)) {
        throw new Error(optionName + ' option must be a valid file path')
      }
    }

    if (!read) {
      return pathVal
    }

    try {
      if (json) {
        return JSON.parse(fs.readFileSync(pathVal).toString())
      } else {
        return fs.readFileSync(pathVal).toString()
      }
    } catch (e) {
      if (json) {
        throw new Error('file in ' + pathVal + ' doesn\'t have a valid JSON content')
      }

      throw new Error('can\'t read file in ' + pathVal)
    }
  }

  if (strict) {
    throw new Error(optionName + ' option must be a file path')
  }

  return value
}

function getUsage (command) {
  return [
    'Usage: ' + command + ' --request <file> --out <file>',
    command + ' --template <file> --out <file>',
    command + ' --template <file> --data <file> --out <file>'
  ].join('\n')
}

function getExamples (command) {
  return [
    [command + ' --request request.json --out output.pdf', 'Start rendering with options in request.json'],
    [command + ' --template template.json --out output.pdf', 'Start rendering with options for template input in template.json'],
    [command + ' --template.recipe phantom-pdf --template.engine handlebars --template.content template.html --out output.pdf', 'Start rendering with inline options for template input'],
    [command + ' --template template.json --data data.json --out output.pdf', 'Start rendering with options for template and data input']
  ]
}
