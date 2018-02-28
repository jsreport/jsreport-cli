const path = require('path')
const os = require('os')
const fs = require('fs')
const events = require('events')
const assign = require('object-assign')
const Promise = require('bluebird')
const isAbsoluteUrl = require('is-absolute-url')
const yargs = require('yargs')
const prompt = require('prompt-tmp')
const packageJson = require('../package.json')
const createCommandParser = require('./createCommandParser')
const instanceHandler = require('./instanceHandler')
const initCmd = require('./commands/init')
const repairCmd = require('./commands/repair')
const winInstallCmd = require('./commands/win-install')
const winUninstallCmd = require('./commands/win-uninstall')
const configureCmd = require('./commands/configure')
const startCmd = require('./commands/start')
const renderCmd = require('./commands/render')
const killCmd = require('./commands/kill')

// commands that work without a jsreport entry point
const IGNORE_ENTRY_POINT_COMMANDS = [
  'init',
  'repair',
  'win-install',
  'win-uninstall',
  'configure',
  'start',
  'render',
  'kill'
]

let BUILT_IN_COMMAND_MODULES = {
  init: initCmd,
  repair: repairCmd,
  'win-install': winInstallCmd,
  'win-uninstall': winUninstallCmd,
  configure: configureCmd,
  start: startCmd,
  render: renderCmd,
  kill: killCmd
}

const AVAILABLE_GLOBAL_OPTIONS = {
  options: [
    'context',
    'verbose',
    'serverUrl',
    'user',
    'password'
  ],
  alwaysGlobal: ['context', 'verbose']
}

BUILT_IN_COMMAND_MODULES = Object.keys(BUILT_IN_COMMAND_MODULES).map((key) => BUILT_IN_COMMAND_MODULES[key])

const useCustomSocketDirectory = process.env.cli_socketsDirectory != null
const ROOT_PATH = path.join(os.tmpdir(), 'jsreport')
const CLI_PATH = path.join(ROOT_PATH, 'cli')
const MAIN_SOCK_PATH = !useCustomSocketDirectory ? path.join(CLI_PATH, 'sock') : process.env.cli_socketsDirectory
const WORKER_SOCK_PATH = path.join(MAIN_SOCK_PATH, 'workerSock')

if (!useCustomSocketDirectory) {
  tryCreate(ROOT_PATH)
  tryCreate(CLI_PATH)
}

tryCreate(MAIN_SOCK_PATH)
tryCreate(WORKER_SOCK_PATH)

class Commander extends events.EventEmitter {
  constructor (cwd, options = {}) {
    super()

    let cliHandler

    events.EventEmitter.call(this)

    this.cwd = cwd || process.cwd()

    this.context = {
      cwd: this.cwd,
      sockPath: MAIN_SOCK_PATH,
      workerSockPath: WORKER_SOCK_PATH,
      staticPaths: options.staticPaths || {},
      appInfo: options.appInfo
    }

    this._commands = {}
    this._commandNames = []
    this._commandsConfig = {}

    if (options.builtInCommands) {
      this._builtInCommands = options.builtInCommands
      this._ignoreEntryPointCommands = options.ignoreEntryPointCommands || []
    } else {
      this._builtInCommands = BUILT_IN_COMMAND_MODULES
      this._ignoreEntryPointCommands = IGNORE_ENTRY_POINT_COMMANDS
    }

    if (options.disabledCommands) {
      this._disabledCommands = options.disabledCommands
    } else {
      this._disabledCommands = []
    }

    this._builtInCommandNames = this._builtInCommands.map(function (cmdModule) { return cmdModule.command })

    this._showHelpWhenNoCommand = options.showHelpWhenNoCommand != null ? Boolean(options.showHelpWhenNoCommand) : true

    // this option tell us that we should use this value as the instance
    // and not try to look up for it
    this._jsreportInstance = options.instance

    // this option tell us that we should use this value as the instance version
    // and not try to look up for it
    this._jsreportVersion = options.jsreportVersion

    // this option tell us that we should use this path as the executable
    // to spawn when we need to use a daemonized process
    this._daemonExecPath = options.daemonExecPath

    // optional path to script being run in the daemonized process
    this._daemonExecScriptPath = options.daemonExecScriptPath

    // this option tell us that we should additionally pass this arguments
    // to the executable when we need to use a daemonized process
    this._daemonExecArgs = options.daemonExecArgs

    // this option tell us that we should additionally pass this options
    // to child_process.spawn when we need to use a daemonized process
    this._daemonExecOpts = options.daemonExecOpts

    // lazy initialization of cli handler, commands will be activated when
    // doing cliHandler.parse()
    if (options.cli) {
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
            coerce: (value) => {
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

    this._cli = cliHandler

    // registering built-in commands
    this._builtInCommands.forEach((commandModule) => this.registerCommand(commandModule))

    setImmediate(() => this.emit('initialized'))

    return this
  }

  async start (args) {
    process.env.JSREPORT_CLI = true

    if (!Array.isArray(args) && typeof args !== 'string') {
      throw new Error('args must be an array or string')
    }

    this.emit('starting')

    const userArgv = yargs(args).argv

    const versionRequired = userArgv.version || userArgv.v
    const helpRequired = userArgv.help || userArgv.h
    const needsPassword = userArgv.password || userArgv.p
    const verboseMode = userArgv.verbose || userArgv.b
    const log = createLog(verboseMode)

    if (userArgv._.length === 0) {
      this.emit('started', null, { handled: versionRequired || helpRequired, mainCommand: null })

      this.emit('parsing', args, this.context)

      let instance
      try {
        instance = await getInstance(this, this._jsreportInstance, () => {}, this.cwd)
      } catch (e) {

      }

      // activating CLI
      try {
        let initialParseError = false

        this._cli.parse(args, (error, argv, output) => {
          if (error) {
            initialParseError = true
            this.emit('parsed', error, args, this.context)

            if (output != null && output !== '') {
              console.error(output)
            }

            return process.exit(1)
          }

          this.emit('parsed', null, args, this.context)

          if (versionRequired) {
            return handleVersionOption(
              this._jsreportVersion ? {
                version: this._jsreportVersion
              } : (typeof instance === 'function' ? instance() : instance)
            )
          }

          if (output != null && output !== '') {
            console.log(output)
          }
        })

        if (initialParseError) {
          return
        }

        // .showHelp() must need to be called outside .parse callback
        // if not the method will not work correctly
        if (this._showHelpWhenNoCommand && !versionRequired && !helpRequired) {
          // show help when no command was specified
          this._cli.showHelp()
        }
      } catch (e) {
        this.emit('parsed', e, args, this.context)
        printErrorAndExit(e)
      }
    }

    const mainCommandReceived = userArgv._[0]

    const commandShouldIgnoreEntryPoint = (
      // if command is explicitly listed as something to ignore
      this._ignoreEntryPointCommands.indexOf(mainCommandReceived) !== -1 ||
      // if command is built-in and version or help options is activated
      (this._builtInCommandNames.indexOf(mainCommandReceived) !== 1 && (versionRequired || helpRequired))
    )

    const optionsForStart = {
      cwd: this.cwd,
      ignoreEntryPoint: commandShouldIgnoreEntryPoint,
      log: log,
      verbose: verboseMode
    }

    const commandConfiguration = this._commandsConfig[mainCommandReceived] || {}

    const onBeforeCLIParse = (err) => {
      const isSupportedCommand = this._commandNames.indexOf(mainCommandReceived) !== -1

      if (err) {
        return this.emit('started', err, null)
      }

      this.emit('started', null, {
        handled: isSupportedCommand || versionRequired || (isSupportedCommand && helpRequired),
        mainCommand: mainCommandReceived
      })
    }

    if (needsPassword && commandConfiguration.globalOptions.indexOf('password') !== -1) {
      // if password has been set by user, just use it
      if (typeof needsPassword === 'string') {
        // we need to add "coerce" function to "p/password" option to
        // allow set a predefined value
        this._cli.option('p', {
          coerce: () => (needsPassword)
        })

        return handleCommand(this, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
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
      }], (err, result) => {
        if (err) {
          const errorToReject = new Error('No value for password option')

          this.emit('started', errorToReject, null)

          return printErrorAndExit(errorToReject)
        }

        // we need to add "coerce" function to "p/password" option to
        // allow set a predefined value
        this._cli.option('p', {
          coerce: () => (result.password)
        })

        handleCommand(this, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
      })
    } else {
      handleCommand(this, mainCommandReceived, args, optionsForStart, onBeforeCLIParse)
    }
  }

  getCommands () {
    return this._commandNames
  }

  async executeCommand (commandName, argv) {
    const command = this._commands[commandName]

    if (!command) {
      throw new Error('"' + commandName + '" command is not a valid command')
    }

    if (typeof command.handler !== 'function') {
      throw new Error('"' + commandName + '" command doesn\'t have a valid handler')
    }

    const commandHandler = command.handler

    this.emit('command.init', commandName, argv)
    this.emit(getCommandEventName(commandName, 'init'), argv)

    try {
      const resolveValue = await commandHandler(argv)
      this.emit('command.success', commandName, resolveValue)
      this.emit(getCommandEventName(commandName, 'success'), resolveValue)

      return resolveValue
    } catch (errorInCommand) {
      this.emit('command.error', commandName, errorInCommand)
      this.emit(getCommandEventName(commandName, 'error'), errorInCommand)
      // propagating error
      throw errorInCommand
    } finally {
      this.emit('command.finish', commandName)
      this.emit(getCommandEventName(commandName, 'finish'))
    }
  }

  registerCommand (commandModule) {
    const commandName = commandModule.command
    const commandBuilder = commandModule.builder || ((yargs) => (yargs))
    const commandConfiguration = Object.assign({}, commandModule.configuration)
    let commandGlobalOptions = Object.assign([], commandConfiguration.globalOptions)

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

    if (this._disabledCommands.indexOf(commandName) !== -1) {
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
      AVAILABLE_GLOBAL_OPTIONS.alwaysGlobal.forEach((opt) => {
        if (commandGlobalOptions.indexOf(opt) === -1) {
          commandGlobalOptions.unshift(opt)
        }
      })
    } else {
      // always add some options to global
      commandGlobalOptions = AVAILABLE_GLOBAL_OPTIONS.alwaysGlobal
    }

    commandConfiguration.globalOptions = commandGlobalOptions

    // wrapping builder to allow some customizations
    const newBuilder = (yargs) => {
      const commandConfig = this._commandsConfig[commandName]
      let shouldGenerateUsage = true
      let originalUsageFn
      let originalCheckFn
      let commandCheckFn
      let modYargs

      if (typeof yargs.usage === 'function') {
        originalUsageFn = yargs.usage

        yargs.usage = (msg, opts) => {
          shouldGenerateUsage = false
          return originalUsageFn.apply(yargs, [msg, opts])
        }
      }

      if (typeof yargs.check === 'function') {
        originalCheckFn = yargs.check

        yargs.check = (fn) => {
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

      modYargs.check(() => {
        const args = Array.prototype.slice.call(arguments)
        const argv = args[0]
        const commandConfig = this._commandsConfig[commandName]

        const unsupportedGlobalOptions = AVAILABLE_GLOBAL_OPTIONS.options.filter((opt) => {
          return commandConfig.globalOptions.indexOf(opt) === -1
        })

        unsupportedGlobalOptions.forEach((opt) => {
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
        modYargs.fail((msg, err) => {
          this.emit('command.error', commandName, err)
          this.emit(getCommandEventName(commandName, 'error'), err)

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

    const bindedHandler = this.executeCommand.bind(this, commandName)

    this._commandsConfig[commandName] = commandConfiguration

    this._cli.command(assign({}, commandModule, {
      builder: newBuilder,
      handler: (argv) => {
        var commandConfig = this._commandsConfig[commandName]
        var shouldExit = commandConfig.disableProcessExit !== true

        return bindedHandler(argv)
          .then(() => {
            // by default the process will be exit after the command has finished
            if (shouldExit) {
              // exit with success code after command has finished
              process.exit(0)
            }
          })
          .catch(function (err) {
            printErrorAndExit(err, shouldExit)
          })
      }
    }))

    this._commands[commandName] = commandModule
    this._commandNames.push(commandName)

    this.emit('command.register', commandName, commandModule)

    return this
  }
}

module.exports = (cwd, options = {}) => new Commander(cwd, options)

// check the command to see if we should handle jsreport instance
// initialization first or just delegate the command to cli handler
async function handleCommand (commander, commandName, args, options, cb) {
  var log = options.log
  var ignoreEntryPoint = options.ignoreEntryPoint
  var cwd = options.cwd
  var verbose = options.verbose
  // creating a new context based on properties of commander's context
  var context = assign({}, commander.context)
  var commandConfig = commander._commandsConfig[commandName]

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

    exitIfCommandIsNotValid(commander, commandName)

    // delegating the command to the CLI and activating it
    return startCLI(log, commander, args, context)
  }

  const getInstanceAsync = commander._jsreportInstance ? Promise.resolve(commander._jsreportInstance) : getInstance(commander, null, log, cwd)

  try {
    const instanceOrFn = await getInstanceAsync
    const instance = await initInstance(
      commander,
      verbose,
      typeof instanceOrFn === 'function' ? instanceOrFn() : instanceOrFn
    )

    context.jsreport = instance
    cb()
    exitIfCommandIsNotValid(commander, commandName)

    startCLI(log, commander, args, context)
  } catch (err) {
    cb(err)
    printErrorAndExit(err)
  }
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
  const args = Array.prototype.slice.call(arguments)

  if (args.length === 2) {
    return _initInstance_.bind(undefined, commander, verbose)
  }

  return _initInstance_(commander, verbose, instance)

  function _initInstance_ (commander, verbose, instance, forceVerbose) {
    let verboseMode = verbose

    commander.emit('instance.initializing')

    if (forceVerbose === true) {
      verboseMode = forceVerbose
    }

    return (
      instanceHandler.initialize(instance, verboseMode)
        .then((result) => {
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
  let versionOutput = 'cli version: ' + packageJson.version

  if (instance) {
    versionOutput = 'jsreport version: ' + instance.version + '\n' + versionOutput
  }

  console.log(versionOutput)
  process.exit(0)
}

function tryCreate (dir) {
  try {
    fs.mkdirSync(dir, '0755')
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }
}

function exitIfCommandIsNotValid (commander, commandName) {
  if (!commander._commands[commandName]) {
    printErrorAndExit(new Error(
      '"' + commandName + '" command not found in this installation, ' +
      'check that you are writing the command correctly or check if the command ' +
      'is available in your installation, use "jsreport -h" to see the list of available commands'
    ))
  }
}

function printErrorAndExit (err, exit) {
  console.error(formatError(err))

  if (err.originalError) {
    console.error('(Original) ' + formatError(err.originalError))
  }

  if (exit === false) {
    return
  }

  process.exit(1)
}

function formatError (err) {
  const message = (err.stack || err.message) || ''

  return message + ' ' + JSON.stringify(err)
}

function createLog (verboseMode) {
  if (verboseMode) {
    return () => {
      const args = Array.prototype.slice.call(arguments)
      console.log.apply(console, args)
    }
  }

  return () => {}
}
