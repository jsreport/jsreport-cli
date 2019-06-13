'use strict'

const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')

const description = 'Generates a jsreport configuration file (*.config.json) based on some questions'
const command = 'configure'

exports.command = command
exports.description = description

exports.builder = (yargs) => {
  const commandOptions = {
    print: {
      alias: 't',
      description: 'Print the generated configuration to the console instead to save it to a file',
      type: 'boolean'
    }
  }

  const options = Object.keys(commandOptions)

  return (
    yargs
      .group(options, 'Command options:')
      .options(commandOptions)
  )
}

exports.handler = async (argv) => {
  const verbose = argv.verbose
  const shouldJustPrint = argv.print
  const context = argv.context
  const cwd = context.cwd
  const appInfo = context.appInfo

  let answers

  if (argv.context.answers != null && typeof argv.context.answers === 'object') {
    if (verbose) {
      console.log('questions already answered..')
    }

    // just useful for testing
    answers = argv.context.answers
  } else {
    if (verbose) {
      console.log('starting with questions..')
    }

    const questions = [
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
        when: (answers) => {
          return answers.serverEnabled
        }
      },
      {
        type: 'input',
        name: 'serverHttpsKey',
        message: 'To use https you need a key file, specify the path to this file:',
        default: 'certificates/server.key',
        when: (answers) => {
          return answers.serverProtocol === 'https' || answers.serverProtocol === 'http-and-https'
        }
      },
      {
        type: 'input',
        name: 'serverHttpsCert',
        message: 'To use https you need a cert file, specify the path to this file:',
        default: 'certificates/server.cert',
        when: (answers) => {
          return answers.serverProtocol === 'https' || answers.serverProtocol === 'http-and-https'
        }
      },
      {
        type: 'input',
        name: 'serverPort',
        message: (answers) => {
          let msg

          if (answers.serverProtocol === 'http-and-https') {
            msg = 'Specify the http port for web server:'
          } else {
            msg = 'Specify the ' + answers.serverProtocol + ' port for web server:'
          }

          return msg
        },
        default: 5488,
        validate: (input) => {
          const valid = !isNaN(parseInt(input, 10))

          if (valid) {
            return true
          }

          return 'port must be a valid number'
        },
        filter: (input) => {
          return parseInt(input, 10)
        },
        when: (answers) => {
          return answers.serverEnabled
        }
      },
      {
        type: 'input',
        name: 'serverHttpsPort',
        message: (answers) => {
          return 'Specify the https port for web server:'
        },
        default: 5489,
        validate: (input) => {
          const valid = !isNaN(parseInt(input, 10))

          if (valid) {
            return true
          }

          return 'port must be a valid number'
        },
        filter: (input) => {
          return parseInt(input, 10)
        },
        when: (answers) => {
          return answers.serverEnabled && answers.serverProtocol === 'http-and-https'
        }
      },
      {
        type: 'confirm',
        name: 'serverAuthEnabled',
        message: 'Do you want to enable authentication in web server?',
        default: false,
        when: (answers) => {
          return answers.serverEnabled
        }
      },
      {
        type: 'input',
        name: 'serverAuthUsername',
        message: 'Specify the admin username to use in web server authentication:',
        default: 'admin',
        when: (answers) => {
          return answers.serverAuthEnabled
        }
      },
      {
        type: 'password',
        name: 'serverAuthPassword',
        message: 'Specify the admin password to use in web server authentication:',
        validate: (input) => {
          const valid = (String(input) !== '')

          if (valid) {
            return true
          }

          return 'password can\'t be empty'
        },
        when: (answers) => {
          return answers.serverAuthEnabled
        }
      },
      {
        type: 'input',
        name: 'serverAuthCookieSecret',
        message: 'Specify a secret text for cookie sessions to use in web server authentication:',
        default: () => {
          return '<your strong secret>'
        },
        when: (answers) => {
          return answers.serverAuthEnabled
        }
      },
      {
        type: 'list',
        name: 'store',
        message: 'Do you want to persist jsreport objects and logs on disk?',
        choices: [{
          name: 'Yes templates and logs will be saved on disk',
          value: 'fs',
          short: 'Yes everything saved on disk'
        }, {
          name: 'Yes, but without log files.',
          value: 'fs-without-log',
          short: `Yes, but logs won't be written on disk`
        }, {
          name: 'No, objects will live in memory until process is finished',
          value: 'memory',
          short: 'No, only memory will be used'
        }],
        default: 0
      },
      {
        type: 'confirm',
        name: 'allowLocalFilesAccess',
        message: 'Can jsreport trust the rendering requests and allow access to local files and modules?',
        default: true
      },
      {
        type: 'confirm',
        name: 'fastStrategies',
        message: 'Should jsreport reuse processes to speed up the rendering?',
        default: true,
        when: () => {
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
        when: (answers) => {
          return answers.store === 'fs' || answers.store.indexOf('fs') === 0
        }
      }
    ]

    answers = await inquirer.prompt(questions)
  }

  const config = { extensions: {} }

  if (verbose) {
    console.log('finishing with questions..')
    console.log('answers:')
    console.log(JSON.stringify(answers, null, 2))
  }

  if (!answers.serverEnabled) {
    config.extensions.express = {
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
      config.extensions.authentication = {
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
      config.extensions.authentication = {
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

  if (answers.store === 'fs') {
    config.store = {
      provider: 'fs'
    }

    config.blobStorage = {
      provider: 'fs'
    }

    config.logger = {
      console: { transport: 'console', level: 'debug' },
      file: { transport: 'file', level: 'info', filename: 'logs/reporter.log' },
      error: { transport: 'file', level: 'error', filename: 'logs/error.log' }
    }
  } else if (answers.store === 'fs-without-log') {
    config.store = {
      provider: 'fs'
    }

    config.blobStorage = {
      provider: 'fs'
    }

    config.logger = {
      console: { transport: 'console', level: 'debug' }
    }
  } else {
    config.store = {
      provider: 'memory'
    }

    config.blobStorage = {
      provider: 'memory'
    }

    config.logger = {
      console: { transport: 'console', level: 'debug' }
    }
  }

  config.allowLocalFilesAccess = answers.allowLocalFilesAccess === true

  config.templatingEngines = { timeout: 10000 }
  config.extensions.scripts = { timeout: 40000 }
  config.chrome = { timeout: 40000 }

  if (answers.createExamples) {
    config.extensions['sample-template'] = {
      createSamples: true
    }
  }

  if (answers.fastStrategies) {
    config.templatingEngines.strategy = 'http-server'
    config.extensions.scripts.strategy = 'http-server'
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

  const configFile = path.join(cwd, 'jsreport.config.json')
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2))

  console.log('config saved in:', configFile)

  return {
    config: config,
    filePath: configFile
  }
}
