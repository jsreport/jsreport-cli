var path = require('path')
var isAbsoluteUrl = require('is-absolute-url')
var yargs = require('yargs')
var prompt = require('prompt')
var createCommandParser = require('./createCommandParser')
var instanceHandler = require('./instanceHandler')

module.exports = function parseCommands (args, cwd) {
  var BUILT_IN_COMMANDS = []

  // commands that work without a jsreport entry point
  var COMMANDS_TO_IGNORE_ENTRY_POINT = [
    'init',
    'repair',
    'install',
    'uninstall'
  ]

  var userArgv = yargs(args).argv
  var versionRequired = userArgv.version || userArgv.v
  var helpRequired = userArgv.help || userArgv.h
  var needsPassword = userArgv.password || userArgv.p
  var verboseMode = userArgv.verbose || userArgv.b
  var log = createLog(verboseMode)
  var cliArgv
  var mainCommandReceived
  var commandShouldIgnoreEntryPoint
  var optionsForStart

  // lazy initialization of cli handler, commands will be activated when
  // doing cliHandler.parse()
  var cliHandler = createCommandParser()
      .commandDir('commands', {
        include: function (pathToCommand) {
          var isCommand = /\.js$/.test(path.basename(pathToCommand))
          var commandName = path.basename(pathToCommand, '.js')

          isCommand = commandName.indexOf('_') !== 0

          // adding built-in commands to our array
          if (isCommand) {
            BUILT_IN_COMMANDS.push(commandName)
          }

          return isCommand
        }
      })
      .option('b', {
        alias: 'verbose',
        description: 'Enables verbose mode',
        type: 'boolean',
        global: true
      })
      .option('s', {
        alias: 'serverUrl',
        description: 'Specifies a url to a remote jsreport server, that server will be the target of the command (only if command support this mode)',
        type: 'string',
        requiresArg: true,
        global: true,
        coerce: function (value) {
          if (!isAbsoluteUrl(value)) {
            throw new Error('serverUrl option must be a valid absolute url')
          }

          return value
        }
      })
      .option('u', {
        alias: 'user',
        description: 'Specifies a username for authentication against a jsreport server (Use if some command needs authentication information)',
        type: 'string',
        requiresArg: true,
        global: true
      })
      .option('p', {
        alias: 'password',
        description: 'Specifies a password for authentication against a jsreport server (Use if some command needs authentication information)',
        global: true
      })
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
      .strict()

  if (userArgv._.length === 0) {
    // activating CLI
    cliArgv = cliHandler.parse(args)

    // show help when no command was specified
    if (cliArgv._.length === 0) {
      return cliHandler.showHelp()
    }
  }

  mainCommandReceived = userArgv._[0]

  commandShouldIgnoreEntryPoint = (
    // if command is explicitly listed as something to ignore
    COMMANDS_TO_IGNORE_ENTRY_POINT.indexOf(mainCommandReceived) !== -1 ||
    // if command is built-in and version or help options is activated
    (BUILT_IN_COMMANDS.indexOf(mainCommandReceived) !== 1 && (versionRequired || helpRequired)) ||
    // if command is built-in and serverUrl option is activated start CLI without entry point
    (BUILT_IN_COMMANDS.indexOf(mainCommandReceived) !== 1 && (userArgv.serverUrl || userArgv.s))
  )

  optionsForStart = {
    cwd: cwd || process.cwd(),
    ignoreEntryPoint: commandShouldIgnoreEntryPoint,
    log: log,
    verbose: verboseMode
  }

  if (needsPassword) {
    prompt.start()

    prompt.message = ''

    return prompt.get([{
      name: 'password',
      description: 'Password',
      message: 'Password can\'t be empty',
      type: 'string',
      hidden: true,
      required: true
    }], function (err, result) {
      if (err) {
        return printErrorAndExit(new Error('No value for password'))
      }

      // we need to add "coerce" function to "p/password" option to
      // allow set a predefined value
      cliHandler.option('p', {
        coerce: function () {
          return result.password
        }
      })

      handleCommand(cliHandler, args, optionsForStart)
    })
  } else {
    handleCommand(cliHandler, args, optionsForStart)
  }
}

// check the command to see if we should handle jsreport instance
// initialization first or just delegate the command to cli handler
function handleCommand (cli, args, options) {
  var log = options.log
  var ignoreEntryPoint = options.ignoreEntryPoint
  var cwd = options.cwd
  var verbose = options.verbose
  var context = {}

  context.cwd = cwd

  if (ignoreEntryPoint) {
    // passing getInstance and initInstance as context
    // to commands when they should ignore the entry point
    context.getInstance = getInstance(log)
    context.initInstance = initInstance(verbose)

    // delegating the command to the CLI and activating it
    return startCLI(log, cli, args, context)
  }

  getInstance(log, cwd)
  .then(function (instance) {
    return initInstance(verbose, instance)
  })
  .then(function (instance) {
    context.jsreport = instance

    startCLI(log, cli, args, context)
  })
  .catch(function (err) {
    printErrorAndExit(err)
  })
}

function startCLI (log, cli, args, context) {
  // we need to add "coerce" function to "context" option to
  // don't allow override this value and preserve the real values
  cli.option('context', {
    coerce: function () {
      return context
    }
  })

  // activating CLI, resolving in next tick to avoid
  // showing errors of commands in catch handler
  process.nextTick(function () {
    try {
      cli.parse(args, { context: context })
    } catch (e) {
      var error = new Error('An unexpected error ocurred while trying to execute the command:')
      error.originalError = e
      printErrorAndExit(error)
    }
  })
}

function getInstance (log, cwd) {
  var args = Array.prototype.slice.call(arguments)

  if (args.length === 1) {
    return _getInstance_.bind(undefined, log)
  }

  return _getInstance_(log, cwd)

  function _getInstance_ (log, cwd) {
    return (
      instanceHandler
      .find(cwd)
      .then(function (instanceInfo) {
        if (instanceInfo.isDefault) {
          log(
            'no entry point was found, creating a default instance ' +
            'using: require("' + instanceInfo.from + '")()'
          )
        } else {
          log('using jsreport instance found in: ' + instanceInfo.entryPoint)
        }

        return instanceInfo.instance
      })
    )
  }
}

function initInstance (verbose, instance) {
  var args = Array.prototype.slice.call(arguments)

  if (args.length === 1) {
    return _initInstance_.bind(undefined, verbose)
  }

  return _initInstance_(verbose, instance)

  function _initInstance_ (verbose, instance) {
    return instanceHandler.initialize(instance, verbose)
  }
}

function printErrorAndExit (err) {
  console.error(err.message)

  if (err.originalError) {
    console.error(err.originalError)
  }

  process.exit(1)
}

function createLog (verboseMode) {
  if (verboseMode) {
    return function () {
      var args = Array.prototype.slice.call(arguments)
      console.log.apply(console, args)
    }
  }

  return function () {}
}
