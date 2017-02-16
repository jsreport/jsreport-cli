'use strict'

var path = require('path')
var fs = require('fs')
var assign = require('object-assign')
var mapAsync = require('map-async')
var pathIsAbsolute = require('path-is-absolute')
var nssocket = require('nssocket')
var jsreportClient = require('jsreport-client')
var normalizeSocketPath = require('../normalizeSocketPath')
var keepAliveProcess = require('../keepAliveProcess')

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
    keepAlive: {
      alias: 'k',
      description: 'Specifies that the process should stay open (handled by the maintainer) for future renders',
      type: 'boolean'
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
      if (argv.user && !argv.serverUrl) {
        throw new Error('user option needs to be used with --serverUrl option')
      }

      if (argv.password && !argv.serverUrl) {
        throw new Error('password option needs to be used with --serverUrl option')
      }

      if (argv.user && !argv.password) {
        throw new Error('user option needs to be used with --password option')
      }

      if (argv.password && !argv.user) {
        throw new Error('password option needs to be used with --user option')
      }

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
  var output = argv.out
  var context = argv.context
  var verbose = argv.verbose
  var cwd = context.cwd
  var sockPath = context.sockPath
  var workerSockPath = context.workerSockPath
  var onError = context.onError
  var getInstance = context.getInstance
  var initInstance = context.initInstance
  var childProc
  var options

  options = getOptions(argv)

  // connect to a remote server
  if (argv.serverUrl) {
    console.log('starting rendering process in ' + argv.serverUrl + '..')

    return startRender(null, {
      verbose: verbose,
      request: options.render,
      output: output,
      remote: options.remote
    })
  }

  // first, try to look up if there is an existing process
  // "daemonized" before in the CWD
  findProcessByCWD(workerSockPath, cwd, function (processLookupErr, processInfo) {
    var adminAuthentication

    if (processLookupErr) {
      return onCriticalError(processLookupErr)
    }

    // if process was found, just connect to it,
    // otherwise just continue processing
    if (processInfo) {
      console.log('using instance daemonized previously..')

      adminAuthentication = processInfo.adminAuthentication || {}

      return (
        startRender(null, {
          verbose: verbose,
          request: options.render,
          output: output,
          remote: {
            url: processInfo.url,
            user: adminAuthentication.username,
            password: adminAuthentication.password
          }
        })
      )
    }

    // start a new daemonized process and then connect to it
    // to render
    if (argv.keepAlive) {
      return (
        keepAliveProcess({
          mainSockPath: sockPath,
          workerSockPath: workerSockPath,
          cwd: cwd,
          verbose: verbose
        })
        .then(function (processInfo) {
          var remoteUrl = processInfo.url
          var adminAuthentication = processInfo.adminAuthentication || {}

          console.log('instance has been daemonized and initialized successfully')

          childProc = processInfo.proc

          return (
            startRender(null, {
              verbose: verbose,
              request: options.render,
              output: output,
              remote: {
                url: remoteUrl,
                user: adminAuthentication.username,
                password: adminAuthentication.password
              },
              onRenderFinish: function () {
                // make sure to unref() the child process after the first render
                // to allow the exit of the current process
                childProc.unref()
              }
            })
          )
        })
        .catch(function (err) {
          if (childProc) {
            childProc.unref()
          }

          onCriticalError(err)
        })
      )
    }

    // look up for an instance in CWD
    getInstance(cwd)
    .then(function (jsreportInstance) {
      return initInstance(jsreportInstance)
    })
    .then(function (jsreportInstance) {
      console.log('starting rendering process..')

      if (verbose) {
        console.log('Output configured to:', output)
      }

      return startRender(jsreportInstance, {
        verbose: verbose,
        request: options.render,
        output: output
      })
    })
    .catch(onCriticalError)
  })

  function onCriticalError (err) {
    var errorToPass = new Error('An error occurred while trying to execute the command:')
    errorToPass.originalError = err
    onError(errorToPass)
  }
}

function startRender (jsreportInstance, options) {
  var remote = options.remote
  var request = options.request
  var output = options.output
  var verbose = options.verbose
  var onRenderFinish = options.onRenderFinish || function () {}
  var outputStream

  if (verbose) {
    if (remote) {
      console.log('remote server options:')
      console.log(remote)
    }

    console.log('rendering with options:')
    console.log(JSON.stringify(request, null, 2))
  }

  if (remote) {
    return jsreportClient(remote.url, remote.user, remote.password).render(request, function (err, response) {
      if (err) {
        onRenderFinish()

        if (err.code === 'ECONNREFUSED') {
          return onRenderingError(
            new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
            ', Please verify that a jsreport server is running')
          )
        }

        if (err.response && err.response.statusCode != null) {
          if (err.response.statusCode === 404) {
            return onRenderingError(
              new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
              ', Please verify that a jsreport server is running')
            )
          } else if (err.response.statusCode === 401) {
            return onRenderingError(
              new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
              ' Authentication error, Please pass correct --user and --password options')
            )
          }
        }

        return onRenderingError(err)
      }

      outputStream = writeFileFromStream(response, output)
      listenOutputStream(outputStream, onRenderFinish)
    })
  }

  return jsreportInstance.render(request).then(function (out) {
    outputStream = writeFileFromStream(out.stream, output)
    listenOutputStream(outputStream, onRenderFinish)
  }).catch(function (err) {
    onRenderFinish()

    onRenderingError(err)
  })
}

function listenOutputStream (outputStream, onRenderFinish) {
  outputStream.on('finish', function () {
    onRenderFinish()

    console.log('rendering has finished successfully and saved in:', outputStream.path)
    process.exit(0)
  })

  outputStream.on('error', function (err) {
    onRenderFinish()

    onRenderingError(err)
  })
}

function writeFileFromStream (stream, output) {
  var outputStream = fs.createWriteStream(output)

  stream.pipe(outputStream)

  return outputStream
}

function onRenderingError (error) {
  console.error('rendering has finished with errors:')
  console.error(error)
  process.exit(1)
}

function findProcessByCWD (sockPath, cwd, cb) {
  getAllProcesses(sockPath, function (err, processes) {
    var procs

    if (err) {
      return cb(err)
    }

    procs = processes.filter(function (p) {
      return p.cwd === cwd
    })

    if (procs.length === 0) {
      return cb(null, null)
    }

    return cb(null, procs[0])
  })
}

function getAllProcesses (sockPath, cb) {
  function getProcess (name, next) {
    var fullPath = path.join(sockPath, name)
    var socket = new nssocket.NsSocket()

    fullPath = normalizeSocketPath(fullPath)

    socket.connect(fullPath, function (connectErr) {
      if (connectErr) {
        return next(connectErr)
      }

      socket.dataOnce(['info'], function (info) {
        next(null, info)
        socket.end()
      })

      socket.send(['info'])
    })

    socket.on('error', function (err) {
      if (err.code === 'ECONNREFUSED') {
        try {
          fs.unlinkSync(fullPath)
        } catch (e) {}

        next()
      } else {
        next()
      }
    })
  }

  getSockets(sockPath, function (err, sockets) {
    if (err) {
      return cb(err)
    }

    mapAsync(sockets, getProcess, function (err, processes) {
      cb(err, processes.filter(Boolean))
    })
  })
}

function getSockets (sockPath, cb) {
  var sockets = []

  try {
    sockets = fs.readdirSync(sockPath)
  } catch (ex) {
    return cb(ex)
  }

  cb(null, sockets)
}

function getOptions (argv) {
  var request = argv.request
  var template = argv.template
  var data = argv.data
  var renderingOpts = {}
  var remote = null

  if (argv.serverUrl) {
    remote = {
      url: argv.serverUrl
    }
  }

  if (argv.user && argv.serverUrl) {
    remote.user = argv.user
  }

  if (argv.password && argv.serverUrl) {
    remote.password = argv.password
  }

  if (request) {
    renderingOpts = request
  }

  if (template) {
    renderingOpts.template = assign({}, renderingOpts.template, template)
  }

  if (data) {
    renderingOpts.data = assign({}, renderingOpts.data, data)
  }

  return {
    render: renderingOpts,
    remote: remote
  }
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