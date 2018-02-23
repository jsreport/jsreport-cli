'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var inquirer = require('inquirer')
var should = require('should')
var sinon = require('sinon')
var utils = require('../utils')
var configure = require('../../lib/commands/configure').handler

describe('configure command', function () {
  var pathToTempProject

  before(function () {
    utils.cleanTempDir(['configure-project'])

    utils.createTempDir(['configure-project'], function (dir, absoluteDir) {
      pathToTempProject = absoluteDir
    })
  })

  beforeEach(function () {
    this.sandbox = sinon.sandbox.create()
  })

  it('should just print configuration', function () {
    this.sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'dev',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    return configure({
      print: true,
      context: {
        cwd: pathToTempProject
      }
    }).then(function (result) {
      should(result.filePath).be.undefined()

      should(result.config).be.eql({
        connectionString: {
          name: 'memory'
        },
        blobStorage: 'inMemory',
        logger: {
          console: { transport: 'console', level: 'debug' }
        },
        express: {
          enabled: false
        },
        phantom: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        electron: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        tasks: {
          strategy: 'dedicated-process',
          timeout: 10000
        },
        scripts: {
          timeout: 40000
        },
        'sample-template': {
          createSamples: false
        }
      })
    })
  })

  it('should generate simple configuration', function () {
    this.sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'dev',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    return configure({
      context: {
        cwd: pathToTempProject
      }
    }).then(function (result) {
      var expectedConfig = {
        connectionString: {
          name: 'memory'
        },
        blobStorage: 'inMemory',
        logger: {
          console: { transport: 'console', level: 'debug' }
        },
        express: {
          enabled: false
        },
        phantom: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        electron: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        tasks: {
          strategy: 'dedicated-process',
          timeout: 10000
        },
        scripts: {
          timeout: 40000
        },
        'sample-template': {
          createSamples: false
        }
      }

      should(fs.existsSync(result.filePath)).be.True()
      should(JSON.parse(fs.readFileSync(result.filePath).toString())).be.eql(expectedConfig)
      should(result.config).be.eql(expectedConfig)
    })
  })

  it('should generate configuration with web server enabled', function () {
    this.sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'dev',
        serverEnabled: true,
        serverProtocol: 'http',
        serverPort: 7500,
        serverAuthEnabled: true,
        serverAuthCookieSecret: 'secret here',
        serverAuthUsername: 'test',
        serverAuthPassword: 'test-pass',
        connectionString: 'fs',
        accessLocalFiles: true,
        fastStrategies: true,
        createExamples: true
      })
    )

    return configure({
      context: {
        cwd: pathToTempProject
      }
    }).then(function (result) {
      var expectedConfig = {
        httpPort: 7500,
        authentication: {
          cookieSession: { secret: 'secret here' },
          admin: { username: 'test', password: 'test-pass' },
          enabled: true
        },
        connectionString: {
          name: 'fs'
        },
        blobStorage: 'fileSystem',
        logger: {
          console: { transport: 'console', level: 'debug' },
          file: { transport: 'file', level: 'info', filename: 'logs/reporter.log' },
          error: { transport: 'file', level: 'error', filename: 'logs/error.log' }
        },
        phantom: {
          allowLocalFilesAccess: true,
          strategy: 'phantom-server',
          timeout: 40000
        },
        electron: {
          allowLocalFilesAccess: true,
          strategy: 'electron-ipc',
          timeout: 40000
        },
        tasks: {
          strategy: 'http-server',
          timeout: 10000,
          allowedModules: '*'
        },
        scripts: {
          timeout: 40000,
          allowedModules: '*'
        },
        assets: {
          allowedFiles: '*.*',
          searchOnDiskIfNotFoundInStore: true
        },
        'sample-template': {
          createSamples: true
        }
      }

      should(fs.existsSync(result.filePath)).be.True()
      should(JSON.parse(fs.readFileSync(result.filePath).toString())).be.eql(expectedConfig)
      should(result.config).be.eql(expectedConfig)
    })
  })

  it('should generate configuration file', function () {
    this.sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'prod',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    return configure({
      context: {
        cwd: pathToTempProject
      }
    }).then(function (result) {
      var expectedConfig = {
        connectionString: {
          name: 'memory'
        },
        blobStorage: 'inMemory',
        logger: {
          console: { transport: 'console', level: 'debug' }
        },
        express: {
          enabled: false
        },
        phantom: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        electron: {
          allowLocalFilesAccess: false,
          strategy: 'dedicated-process',
          timeout: 40000
        },
        tasks: {
          strategy: 'dedicated-process',
          timeout: 10000
        },
        scripts: {
          timeout: 40000
        },
        'sample-template': {
          createSamples: false
        }
      }

      should(fs.existsSync(result.filePath)).be.True()
      should(path.basename(result.filePath)).be.eql('jsreport.config.json')
      should(JSON.parse(fs.readFileSync(result.filePath).toString())).be.eql(expectedConfig)
      should(result.config).be.eql(expectedConfig)
    })
  })

  afterEach(function () {
    if (fs.existsSync(path.join(pathToTempProject, 'jsreport.config.json'))) {
      fs.unlinkSync(path.join(pathToTempProject, 'jsreport.config.json'))
    }

    this.sandbox.restore()
  })

  after(function () {
    utils.cleanTempDir(['configure-project'])
  })
})
