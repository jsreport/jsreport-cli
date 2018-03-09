const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')
const should = require('should')
const sinon = require('sinon')
const utils = require('../utils')
const configure = require('../../lib/commands/configure').handler

describe('configure command', () => {
  let pathToTempProject
  let sandbox

  before(() => {
    utils.cleanTempDir(['configure-project'])
    utils.createTempDir(['configure-project'], (dir, absoluteDir) => (pathToTempProject = absoluteDir))
  })

  beforeEach(() => (sandbox = sinon.sandbox.create()))

  it('should just print configuration', async () => {
    sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'dev',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    const result = await configure({
      print: true,
      context: {
        cwd: pathToTempProject
      }
    })
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

  it('should generate simple configuration', async () => {
    sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'dev',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    const result = await configure({
      context: {
        cwd: pathToTempProject
      }
    })
    const expectedConfig = {
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

  it('should generate configuration with web server enabled', async () => {
    sandbox.stub(inquirer, 'prompt').returns(
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

    const result = await configure({
      context: {
        cwd: pathToTempProject
      }
    })

    const expectedConfig = {
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

  it('should generate configuration file', async () => {
    sandbox.stub(inquirer, 'prompt').returns(
      Promise.resolve({
        env: 'prod',
        serverEnabled: false,
        connectionString: 'memory',
        accessLocalFiles: false,
        fastStrategies: false,
        createExamples: false
      })
    )

    const result = await configure({
      context: {
        cwd: pathToTempProject
      }
    })

    const expectedConfig = {
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

  afterEach(() => {
    if (fs.existsSync(path.join(pathToTempProject, 'jsreport.config.json'))) {
      fs.unlinkSync(path.join(pathToTempProject, 'jsreport.config.json'))
    }

    sandbox.restore()
  })

  after(() => utils.cleanTempDir(['configure-project']))
})
