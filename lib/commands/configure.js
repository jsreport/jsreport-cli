'use strict'

var path = require('path')
var fs = require('fs')
var inquirer = require('inquirer')

var description = 'Generates a jsreport configuration file (*.config.json) based on some questions'
var command = 'configure'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  var commandOptions = {
    print: {
      alias: 't',
      description: 'Print the generated configuration to the console instead to save it to a file',
      type: 'boolean'
    }
  }

  var options = Object.keys(commandOptions)

  return (
    yargs
    .group(options, 'Command options:')
    .options(commandOptions)
  )
}

exports.handler = function (argv) {
  var verbose = argv.verbose
  var shouldJustPrint = argv.print
  var context = argv.context
  var cwd = context.cwd
  var appInfo = context.appInfo
  var questions

  if (verbose) {
    console.log('starting with questions..')
  }

  questions = [
    {
      type: 'list',
      name: 'env',
      message: 'For which environment would you like to generate configuration?',
      choices: [{
        name: 'development (dev)',
        value: 'dev',
        short: 'dev'
      }, {
        name: 'production (prod)',
        value: 'prod',
        short: 'prod'
      }],
      default: 0
    },
    {
      type: 'confirm',
      name: 'serverEnabled',
      message: 'Do you want to enable web server?',
      default: true
    },
    {
      type: 'list',
      name: 'serverProtocol',
      message: 'Which protocol should web server use?',
      choices: [{
        name: 'http',
        value: 'http'
      }, {
        name: 'https',
        value: 'https'
      }, {
        name: 'http and https (http will redirect to https)',
        value: 'http-and-https'
      }],
      default: 0,
      when: function (answers) {
        return answers.serverEnabled
      }
    },
    {
      type: 'input',
      name: 'serverHttpsKey',
      message: 'To use https you need a key file, specify the path to this file:',
      default: 'certificates/server.key',
      when: function (answers) {
        return answers.serverProtocol === 'https' || answers.serverProtocol === 'http-and-https'
      }
    },
    {
      type: 'input',
      name: 'serverHttpsCert',
      message: 'To use https you need a cert file, specify the path to this file:',
      default: 'certificates/server.cert',
      when: function (answers) {
        return answers.serverProtocol === 'https' || answers.serverProtocol === 'http-and-https'
      }
    },
    {
      type: 'input',
      name: 'serverPort',
      message: function (answers) {
        var msg

        if (answers.serverProtocol === 'http-and-https') {
          msg = 'Specify the http port for web server:'
        } else {
          msg = 'Specify the ' + answers.serverProtocol + ' port for web server:'
        }

        return msg
      },
      default: 5488,
      validate: function (input) {
        var valid = !isNaN(parseInt(input, 10))

        if (valid) {
          return true
        }

        return 'port must be a valid number'
      },
      filter: function (input) {
        return parseInt(input, 10)
      },
      when: function (answers) {
        return answers.serverEnabled
      }
    },
    {
      type: 'input',
      name: 'serverHttpsPort',
      message: function (answers) {
        return 'Specify the https port for web server:'
      },
      default: 5489,
      validate: function (input) {
        var valid = !isNaN(parseInt(input, 10))

        if (valid) {
          return true
        }

        return 'port must be a valid number'
      },
      filter: function (input) {
        return parseInt(input, 10)
      },
      when: function (answers) {
        return answers.serverEnabled && answers.serverProtocol === 'http-and-https'
      }
    },
    {
      type: 'confirm',
      name: 'serverAuthEnabled',
      message: 'Do you want to enable authentication in web server?',
      default: false,
      when: function (answers) {
        return answers.serverEnabled
      }
    },
    {
      type: 'input',
      name: 'serverAuthUsername',
      message: 'Specify the admin username to use in web server authentication:',
      default: 'admin',
      when: function (answers) {
        return answers.serverAuthEnabled
      }
    },
    {
      type: 'password',
      name: 'serverAuthPassword',
      message: 'Specify the admin password to use in web server authentication:',
      validate: function (input) {
        var valid = (String(input) !== '')

        if (valid) {
          return true
        }

        return 'password can\'t be empty'
      },
      when: function (answers) {
        return answers.serverAuthEnabled
      }
    },
    {
      type: 'input',
      name: 'serverAuthCookieSecret',
      message: 'Specify a secret text for cookie sessions to use in web server authentication:',
      default: function () {
        return '<your strong secret>'
      },
      when: function (answers) {
        return answers.serverAuthEnabled
      }
    },
    {
      type: 'list',
      name: 'connectionString',
      message: 'Do you want to persist jsreport objects in disk?',
      choices: [{
        name: 'Yes (templates, data, assets, scripts, etc and logs will be saved in disk)',
        value: 'fs',
        short: 'Yes, fs connection with log files will be used'
      }, {
        name: 'Yes, but without log files (templates, data, assets, scripts, etc will be saved in disk)',
        value: 'fs-without-log',
        short: 'Yes, fs connection without log files will be used'
      }, {
        name: 'No (objects will live in memory until process is finished)',
        value: 'memory',
        short: 'No, memory connection will be used'
      }],
      default: 0
    },
    {
      type: 'confirm',
      name: 'accessLocalFiles',
      message: 'Do you want jsreport to enable local file access?',
      default: true
    },
    {
      type: 'confirm',
      name: 'fastStrategies',
      message: 'Do you want to configure the fastest strategies for jsreport execution (tasks, recipes)?',
      default: true,
      when: function () {
        // only enable this question if configure
        // is running from node.js based installation
        return appInfo == null
      }
    },
    {
      type: 'confirm',
      name: 'createExamples',
      message: 'Would you like that we create some default examples for you?',
      default: true,
      when: function (answers) {
        return answers.connectionString.indexOf('fs') === 0
      }
    }
  ]

  return (
    inquirer.prompt(questions)
    .then(function (answers) {
      var configFile = path.join(cwd, answers.env + '.config.json')
      var config = {}

      if (verbose) {
        console.log('finishing with questions..')
        console.log('answers:')
        console.log(JSON.stringify(answers, null, 2))
      }

      if (!answers.serverEnabled) {
        config.express = {
          enabled: false
        }
      }

      if (answers.serverEnabled) {
        if (answers.serverProtocol === 'http-and-https') {
          config.httpPort = answers.serverPort
          config.httpsPort = answers.serverHttpsPort

          config.certificate = {
            key: answers.serverHttpsKey,
            cert: answers.serverHttpsCert
          }
        } else {
          config[answers.serverProtocol === 'http' ? 'httpPort' : 'httpsPort'] = answers.serverPort

          if (answers.serverProtocol === 'https') {
            config.certificate = {
              key: answers.serverHttpsKey,
              cert: answers.serverHttpsCert
            }
          }
        }

        if (answers.serverAuthEnabled) {
          config.authentication = {
            cookieSession: {
              secret: answers.serverAuthCookieSecret
            },
            admin: {
              username: answers.serverAuthUsername,
              password: answers.serverAuthPassword
            },
            enabled: true
          }
        } else {
          config.authentication = {
            cookieSession: {
              secret: '<your strong secret here>'
            },
            admin: {
              username: 'admin',
              password: 'password'
            },
            enabled: false
          }
        }
      }

      if (answers.connectionString === 'fs') {
        config.connectionString = {
          name: 'fs'
        }

        config.logger = {
          console: { transport: 'console', level: 'debug' },
          file: { transport: 'file', level: 'info', filename: 'logs/reporter.log' },
          error: { transport: 'file', level: 'error', filename: 'logs/error.log' }
        }

        config.blobStorage = 'fileSystem'
      } else if (answers.connectionString === 'fs-without-log') {
        config.connectionString = {
          name: 'fs'
        }

        config.blobStorage = 'fileSystem'

        config.logger = {
          console: { transport: 'console', level: 'debug' }
        }
      } else {
        config.connectionString = {
          name: 'memory'
        }

        config.blobStorage = 'inMemory'

        config.logger = {
          console: { transport: 'console', level: 'debug' }
        }
      }

      if (answers.accessLocalFiles) {
        config.tasks = {
          allowedModules: '*'
        }

        config.scripts = {
          allowedModules: '*'
        }

        config.assets = {
          allowedFiles: '*.*',
          searchOnDiskIfNotFoundInStore: true
        }

        config.phantom = {
          allowLocalFilesAccess: true
        }

        config.electron = {
          allowLocalFilesAccess: true
        }
      } else {
        config.phantom = {
          allowLocalFilesAccess: false
        }

        config.electron = {
          allowLocalFilesAccess: false
        }
      }

      if (!config.tasks) {
        config.tasks = {}
      }

      if (!config.scripts) {
        config.scripts = {}
      }

      if (!config.phantom) {
        config.phantom = {}
      }

      if (!config.electron) {
        config.electron = {}
      }

      if (answers.fastStrategies) {
        config.tasks.strategy = 'http-server'
        config.phantom.strategy = 'phantom-server'
        config.electron.strategy = 'electron-ipc'
      } else {
        config.tasks.strategy = 'dedicated-process'
        config.phantom.strategy = 'dedicated-process'
        config.electron.strategy = 'dedicated-process'
      }

      config.tasks.timeout = 10000
      config.scripts.timeout = 40000
      config.phantom.timeout = 40000
      config.electron.timeout = 40000

      if (answers.createExamples) {
        config['sample-template'] = {
          createSamples: true
        }
      } else {
        config['sample-template'] = {
          createSamples: false
        }
      }

      if (verbose || shouldJustPrint) {
        console.log('generated config:')
        console.log(JSON.stringify(config, null, 2))
      }

      if (shouldJustPrint) {
        return {
          config: config
        }
      }

      fs.writeFileSync(configFile, JSON.stringify(config, null, 2))

      console.log('config saved in:', configFile)

      return {
        config: config,
        filePath: configFile
      }
    })
  )
}
