var util = require('util')
var path = require('path')
var fs = require('fs')
var events = require('events')
var assign = require('object-assign')
var Promise = require('bluebird')
var isAbsoluteUrl = require('is-absolute-url')
var homedir = require('os-homedir')
var yargs = require('yargs')
var prompt = require('prompt-tmp')
var packageJson = require('../package.json')
var createCommandParser = require('./createCommandParser')
var instanceHandler = require('./instanceHandler')
var initCmd = require('./commands/init')
var repairCmd = require('./commands/repair')
var winInstallCmd = require('./commands/win-install')
var winUninstallCmd = require('./commands/win-uninstall')
var configureCmd = require('./commands/configure')
var startCmd = require('./commands/start')
var renderCmd = require('./commands/render')
var killCmd = require('./commands/kill')

// commands that work without a jsreport entry point
var IGNORE_ENTRY_POINT_COMMANDS = [
  'init',
  'repair',
  'win-install',
  'win-uninstall',
  'configure',
  'start',
  'render',
  'kill'
]

var BUILT_IN_COMMAND_MODULES = {
  init: initCmd,
  repair: repairCmd,
  'win-install': winInstallCmd,
  'win-uninstall': winUninstallCmd,
  configure: configureCmd,
  start: startCmd,
  render: renderCmd,
  kill: killCmd
}

var AVAILABLE_GLOBAL_OPTIONS = {
  options: [
    'context',
    'verbose',
    'serverUrl',
    'user',
    'password'
  ],
  alwaysGlobal: ['context', 'verbose']
}

BUILT_IN_COMMAND_MODULES = Object.keys(BUILT_IN_COMMAND_MODULES).map(function (key) {
  return BUILT_IN_COMMAND_MODULES[key]
})

var ROOT_PATH = path.join(homedir(), '.jsreport')

if (!ROOT_PATH) {
  console.error('Couldn\'t detect the user home folder')
  process.exit(1)
}

var MAIN_SOCK_PATH = path.join(ROOT_PATH, 'sock')
var WORKER_SOCK_PATH = path.join(MAIN_SOCK_PATH, 'workerSock')

tryCreate(ROOT_PATH)
tryCreate(MAIN_SOCK_PATH)
tryCreate(WORKER_SOCK_PATH)

var Commander = module.exports = function Commander (cwd, options) {
  if (!(this instanceof Commander)) {
    return new Commander(cwd, options)
  }

  var self = this
  var opts = options || {}
  var cliHandler

  events.EventEmitter.call(self)

  self.cwd = cwd || process.cwd()

  self.context = {
    cwd: self.cwd,
    sockPath: MAIN_SOCK_PATH,
    workerSockPath: WORKER_SOCK_PATH,
    staticPaths: opts.staticPaths || {},
    appInfo: opts.appInfo
  }

  self._commands = {}
  self._commandNames = []
  self._commandsConfig = {}

  if (opts.builtInCommands) {
    self._builtInCommands = opts.builtInCommands
    self._ignoreEntryPointCommands = opts.ignoreEntryPointCommands || []
  } else {
    self._builtInCommands = BUILT_IN_COMMAND_MODULES
    self._ignoreEntryPointCommands = IGNORE_ENTRY_POINT_COMMANDS
  }

  if (opts.disabledCommands) {
    self._disabledCommands = opts.disabledCommands
  } else {
    self._disabledCommands = []
  }

  self._builtInCommandNames = self._builtInCommands.map(function (cmdModule) { return cmdModule.command })

  self._showHelpWhenNoCommand = opts.showHelpWhenNoCommand != null ? Boolean(opts.showHelpWhenNoCommand) : true

  // this option tell us that we should use this value as the instance
  // and not try to look up for it
  self._jsreportInstance = opts.instance

  // this option tell us that we should use this path as the executable
  // to spawn when we need to use a daemonized process
  self._daemonExecPath = opts.daemonExecPath

  // optional path to script being run in the daemonized process
  self._daemonExecScriptPath = opts.daemonExecScriptPath

  // this option tell us that we should additionally pass this arguments
  // to the executable when we need to use a daemonized process
  self._daemonExecArgs = opts.daemonExecArgs

  // this option tell us that we should additionally pass this options
  // to child_process.spawn when we need to use a daemonized process
  self._daemonExecOpts = opts.daemonExecOpts

  // lazy initialization of cli handler, commands will be activated when
  // doing cliHandler.parse()
  if (opts.cli) {
    cliHandler = createCommandParser(options.cli)
  } else {
    cliHandler = (
      createCommandParser()
      .option('verbose', {
        alias: 'b',
        description: 'Enables verbose mode',
        type: 'boolean'
      })
      .option('serverUrl', {
        alias: 's',
        description: 'Specifies a url to a remote jsreport server, that server will be the target of the command (only if command support this mode)',
        type: 'string',
        requiresArg: true,
        coerce: function (value) {
          if (!isAbsoluteUrl(value)) {
            throw new Error('serverUrl option must be a valid absolute url')
          }

          return value
        }
      })
      .option('user', {
        alias: 'u',
        description: 'Specifies a username for authentication against a jsreport server (Use if some command needs authentication information)',
        type: 'string',
        requiresArg: true
      })
      .option('password', {
        alias: 'p',
        description: 'Specifies a password for authentication against a jsreport server (Use if some command needs authentication information)'
      })
      .strict()
    )
  }

  self._cli = cliHandler

  // registering built-in commands
  self._builtInCommands.forEach(function (commandModule) {
    self.registerCommand(commandModule)
  })

  setImmediate(function () {
    self.emit('initialized')
  })

  return this
}

util.inherits(Commander, events.EventEmitter)

Commander.prototype.start = function start (args) {
  var self = this
  var cwd = self.cwd
  var cliHandler = self._cli
  var ignoreEntryPointCommands = self._ignoreEntryPointCommands
  var builtInCommandNames = self._builtInCommandNames
  var initialParseError = false
  var userArgv
  var mainCommandReceived
  var commandShouldIgnoreEntryPoint
  var commandConfiguration
  var optionsForStart
  var versionRequired
  var helpRequired
  var needsPassword
  var verboseMode
  var log

  process.env.JSREPORT_CLI = true

  if (!Array.isArray(args) && typeof args !== 'string') {
    throw new Error('args must be an array or string')
  }

  self.emit('starting')

  userArgv = yargs(args).argv

  versionRequired = userArgv.version || userArgv.v
  helpRequired = userArgv.help || userArgv.h
  needsPassword = userArgv.password || userArgv.p
  verboseMode = userArgv.verbose || userArgv.b
  log = createLog(verboseMode)

  if (userArgv._.length === 0) {
    self.emit('started', null, { handled: versionRequired || helpRequired, mainCommand: null })

    self.emit('parsing', args, self.context)

    return new Promise(function (resolve, reject) {
      getInstance(self, self._jsreportInstance, function () {}, cwd)
      .then(function (instance) {
        resolve(instance)
      })
      .catch(function () {
        resolve(null)
      })
    }).then(function (instance) {
      // activating CLI
      try {
        cliHandler.parse(args, function (error, argv, output) {
          if (error) {
            initialParseError = true
            self.emit('parsed', error, args, self.context)

            if (output != null && output !== '') {
              console.error(output)
            }

            return process.exit(1)
          }

          self.emit('parsed', null, args, self.context)

          if (versionRequired) {
            return handleVersionOption(instance)
          }

          if (output != null && output !== '') {
            console.log(output)
          }
        })

        // .showHelp() must need to be called outside .parse callback
        // if not the method will not work correctly
        if (self._showHelpWhenNoCommand && !initialParseError && !versionRequired && !helpRequired) {
          // show help when no command was specified
          cliHandler.showHelp()
        }
      } catch (e) {
        self.emit('parsed', e, args, self.context)
        printErrorAndExit(e)
      }
    })
  }

  mainCommandReceived = userArgv._[0]

  commandShouldIgnoreEntryPoint = (
    // if command is explicitly listed as something to ignore
    ignoreEntryPointCommands.indexOf(mainCommandReceived) !== -1 ||
    // if command is built-in and version or help options is activated
    (builtInCommandNames.indexOf(mainCommandReceived) !== 1 && (versionRequired || helpRequired))
  )

  optionsForStart = {
    cwd: cwd,
    ignoreEntryPoint: commandShouldIgnoreEntryPoint,
    log: log,
    verbose: verboseMode
  }

  commandConfiguration = self._commandsConfig[mainCommandReceived] || {}

  if (needsPassword && commandConfiguration.globalOptions.indexOf('password') !== -1) {
    // if password has been set by user, just use it
    if (typeof needsPassword === 'string') {
      // we need to add "coerce" function to "p/password" option to
      // allow set a predefined value
      cliHandler.option('p', {
        coerce: function () {
          return needsPassword
        }
      })

      return handleCommand(self, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
    }

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
      var errorToReject

      if (err) {
        errorToReject = new Error('No value for password option')

        self.emit('started', errorToReject, null)

        return printErrorAndExit(errorToReject)
      }

      // we need to add "coerce" function to "p/password" option to
      // allow set a predefined value
      cliHandler.option('p', {
        coerce: function () {
          return result.password
        }
      })

      handleCommand(self, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
    })
  } else {
    handleCommand(self, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
  }

  function onBeforeCLIParse (err) {
    var isSupportedCommand = self._commandNames.indexOf(mainCommandReceived) !== -1

    if (err) {
      return self.emit('started', err, null)
    }

    self.emit('started', null, {
      handled: isSupportedCommand || versionRequired || helpRequired,
      mainCommand: mainCommandReceived
    })
  }
}

Commander.prototype.getCommands = function getCommands () {
  return this._commandNames
}

Commander.prototype.executeCommand = function executeCommand (commandName, argv) {
  var self = this
  var command = self._commands[commandName]
  var commandHandler

  if (!command) {
    return Promise.reject(new Error('"' + commandName + '" command is not a valid command'))
  }

  if (typeof command.handler !== 'function') {
    return Promise.reject(new Error('"' + commandName + '" command doesn\'t have a valid handler'))
  }

  commandHandler = command.handler

  return Promise.try(function () {
    self.emit('command.init', commandName, argv)
    self.emit(getCommandEventName(commandName, 'init'), argv)

    return commandHandler(argv)
  }).then(function (resolveValue) {
    self.emit('command.success', commandName, resolveValue)
    self.emit(getCommandEventName(commandName, 'success'), resolveValue)

    self.emit('command.finish', commandName)
    self.emit(getCommandEventName(commandName, 'finish'))

    return resolveValue
  }).catch(function (errorInCommand) {
    self.emit('command.error', commandName, errorInCommand)
    self.emit(getCommandEventName(commandName, 'error'), errorInCommand)

    self.emit('command.finish', commandName)
    self.emit(getCommandEventName(commandName, 'finish'))

    // propagating error
    throw errorInCommand
  })
}

Commander.prototype.registerCommand = function registerCommand (commandModule) {
  var commandName = commandModule.command
  var commandBuilder = commandModule.builder
  var commandConfiguration = assign({}, commandModule.configuration)
  var commandGlobalOptions = assign([], commandConfiguration.globalOptions)
  var bindedHandler
  var newBuilder
  var self = this

  if (typeof commandModule.command !== 'string' || !commandModule.command) {
    throw new Error('command module must have a .command property of type string')
  }

  if (typeof commandModule.description !== 'string') {
    throw new Error('command module must have a .description property of type string')
  }

  if (typeof commandModule.handler !== 'function') {
    throw new Error('command module must have a .handler property of type function')
  }

  if (commandBuilder != null && typeof commandBuilder !== 'function') {
    throw new Error('command module .builder property must be a function')
  }

  if (self._disabledCommands.indexOf(commandName) !== -1) {
    return
  }

  if (commandGlobalOptions) {
    commandGlobalOptions = commandGlobalOptions.map(function (opt) {
      if (AVAILABLE_GLOBAL_OPTIONS.options.indexOf(opt) === -1) {
        return null
      }

      return opt
    })

    // removing invalid options
    commandGlobalOptions.filter(Boolean)

    // always add some options to global
    AVAILABLE_GLOBAL_OPTIONS.alwaysGlobal.forEach(function (opt) {
      if (commandGlobalOptions.indexOf(opt) === -1) {
        commandGlobalOptions.unshift(opt)
      }
    })
  } else {
    // always add some options to global
    commandGlobalOptions = AVAILABLE_GLOBAL_OPTIONS.alwaysGlobal
  }

  commandConfiguration.globalOptions = commandGlobalOptions

  if (commandBuilder == null) {
    commandBuilder = function (yargs) { return yargs }
  }

  // wrapping builder to allow some customizations
  newBuilder = function (yargs) {
    var commandConfig = self._commandsConfig[commandName]
    var shouldGenerateUsage = true
    var originalUsageFn
    var originalCheckFn
    var commandCheckFn
    var modYargs

    if (typeof yargs.usage === 'function') {
      originalUsageFn = yargs.usage

      yargs.usage = function (msg, opts) {
        shouldGenerateUsage = false
        return originalUsageFn.apply(yargs, [msg, opts])
      }
    }

    if (typeof yargs.check === 'function') {
      originalCheckFn = yargs.check

      yargs.check = function (fn) {
        commandCheckFn = fn
        return yargs
      }
    }

    modYargs = commandBuilder(yargs)

    if (typeof yargs.usage === 'function') {
      yargs.usage = originalUsageFn
      modYargs.usage = originalUsageFn

      if (shouldGenerateUsage) {
        modYargs.usage(commandModule.description + '\n\nUsage: jsreport ' + commandName)
      }
    }

    if (typeof yargs.check === 'function') {
      yargs.check = originalCheckFn
      modYargs.check = originalCheckFn
    }

    modYargs.check(function () {
      var args = Array.prototype.slice.call(arguments)
      var argv = args[0]
      var commandConfig = self._commandsConfig[commandName]
      var unsupportedGlobalOptions

      unsupportedGlobalOptions = AVAILABLE_GLOBAL_OPTIONS.options.filter(function (opt) {
        return commandConfig.globalOptions.indexOf(opt) === -1
      })

      unsupportedGlobalOptions.forEach(function (opt) {
        if (argv[opt]) {
          throw new Error(opt + ' global option is not supported in this command')
        }
      })

      if (commandCheckFn) {
        return commandCheckFn.apply(undefined, args)
      }

      return true
    })

    if (typeof modYargs.fail === 'function') {
      // making command strict and registering a generalized fail function
      modYargs.fail(function (msg, err) {
        self.emit('command.error', commandName, err)
        self.emit(getCommandEventName(commandName, 'error'), err)

        console.error(commandName + ' command error:')
        console.error(msg)

        console.error('type jsreport ' + commandName + ' -h to get help about usage and available options')

        process.exit(1)
      })

      if (commandConfig.disableStrictOptions !== true) {
        modYargs.strict()
      }
    }

    return modYargs
  }

  bindedHandler = self.executeCommand.bind(self, commandName)

  self._commandsConfig[commandName] = commandConfiguration

  self._cli.command(assign({}, commandModule, {
    builder: newBuilder,
    handler: function executeCommandInCLIContext (argv) {
      var commandConfig = self._commandsConfig[commandName]
      var shouldExit = commandConfig.disableProcessExit !== true

      return (
        bindedHandler(argv)
        .then(function () {
          // by default the process will be exit after the command has finished
          if (shouldExit) {
            // exit with success code after command has finished
            process.exit(0)
          }
        })
        .catch(function (err) {
          printErrorAndExit(err, shouldExit)
        })
      )
    }
  }))

  self._commands[commandName] = commandModule
  self._commandNames.push(commandName)

  self.emit('command.register', commandName, commandModule)

  return this
}

// check the command to see if we should handle jsreport instance
// initialization first or just delegate the command to cli handler
function handleCommand (commander, commandName, args, options, cb) {
  var log = options.log
  var ignoreEntryPoint = options.ignoreEntryPoint
  var cwd = options.cwd
  var verbose = options.verbose
  // creating a new context based on properties of commander's context
  var context = assign({}, commander.context)
  var commandConfig = commander._commandsConfig[commandName]
  var getInstanceAsync

  if (commandConfig && commandConfig.globalOptions) {
    commandConfig.globalOptions.forEach(function (optName) {
      commander._cli.global(optName)
    })
  }

  if (commander._daemonExecPath || commander._daemonExecArgs || commander._daemonExecOpts || commander._daemonExecScriptPath) {
    context.daemonExec = {}

    if (commander._daemonExecPath) {
      context.daemonExec.path = commander._daemonExecPath
    }

    if (commander._daemonExecArgs) {
      context.daemonExec.args = commander._daemonExecArgs
    }

    if (commander._daemonExecOpts) {
      context.daemonExec.opts = commander._daemonExecOpts
    }

    if (commander._daemonExecScriptPath) {
      context.daemonExec.scriptPath = commander._daemonExecScriptPath
    }
  }

  if (ignoreEntryPoint) {
    // passing getInstance and initInstance as context
    // to commands when they should ignore the entry point
    context.getInstance = getInstance(commander, commander._jsreportInstance, log)
    context.initInstance = initInstance(commander, verbose)

    cb()

    // delegating the command to the CLI and activating it
    return startCLI(log, commander, args, context)
  }

  if (commander._jsreportInstance) {
    getInstanceAsync = Promise.resolve(commander._jsreportInstance)
  } else {
    getInstanceAsync = getInstance(commander, null, log, cwd)
  }

  getInstanceAsync.then(function (instance) {
    return initInstance(commander, verbose, instance)
  })
  .then(function (instance) {
    context.jsreport = instance

    cb()

    startCLI(log, commander, args, context)
  })
  .catch(function (err) {
    cb(err)

    printErrorAndExit(err)
  })
}

function startCLI (log, commander, args, context) {
  var cli = commander._cli

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
      commander.emit('parsing', args, context)

      cli.parse(args, { context: context }, function (error, argv, output) {
        if (error) {
          commander.emit('parsed', error, args, context)

          if (output != null && output !== '') {
            console.error(output)
          }

          return process.exit(1)
        }

        commander.emit('parsed', null, args, context)

        if (output != null && output !== '') {
          console.log(output)
        }
      })
    } catch (e) {
      var error = new Error('An unexpected error ocurred while trying to execute the command:')
      error.originalError = e

      commander.emit('parsed', e, args, context)

      printErrorAndExit(error)
    }
  })
}

function getInstance (commander, prevInstance, log, cwd) {
  var args = Array.prototype.slice.call(arguments)

  if (args.length === 3) {
    return _getInstance_.bind(undefined, commander, prevInstance, log)
  }

  return _getInstance_(commander, prevInstance, log, cwd)

  function _getInstance_ (commander, prevInstance, log, cwd) {
    if (prevInstance) {
      log('using jsreport instance passed from options')

      return Promise.resolve(prevInstance)
    }

    commander.emit('instance.lookup')

    return (
      instanceHandler
      .find(cwd)
      .then(function (instanceInfo) {
        if (instanceInfo.isDefault) {
          commander.emit('instance.default', instanceInfo.instance)

          log(
            'no entry point was found, creating a default instance ' +
            'using: require("' + instanceInfo.from + '")()'
          )
        } else {
          commander.emit('instance.found', instanceInfo.instance)

          log('using jsreport instance found in: ' + instanceInfo.entryPoint)
        }

        return instanceInfo.instance
      })
    )
  }
}

function initInstance (commander, verbose, instance) {
  var args = Array.prototype.slice.call(arguments)

  if (args.length === 2) {
    return _initInstance_.bind(undefined, commander, verbose)
  }

  return _initInstance_(commander, verbose, instance)

  function _initInstance_ (commander, verbose, instance, forceVerbose) {
    var verboseMode = verbose

    commander.emit('instance.initializing')

    if (forceVerbose === true) {
      verboseMode = forceVerbose
    }

    return (
      instanceHandler.initialize(instance, verboseMode)
      .then(function (result) {
        commander.emit('instance.initialized', result)

        return result
      })
    )
  }
}

function getCommandEventName (command, event) {
  return 'command' + '.' + command + '.' + event
}

function handleVersionOption (instance) {
  var versionOutput = 'cli version: ' + packageJson.version

  if (instance) {
    versionOutput = 'jsreport version: ' + instance.version + '\n' + versionOutput
  }

  console.log(versionOutput)
  process.exit(0)
}

function tryCreate (dir) {
  try {
    fs.mkdirSync(dir, '0755')
  } catch (ex) { }
}

function printErrorAndExit (err, exit) {
  console.error(err.message)

  if (err.originalError) {
    console.error(err.originalError)
  }

  if (exit === false) {
    return
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
