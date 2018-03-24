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
      renderingSource: 'untrusted',
      store: {
        provider: 'memory'
      },
      blobStorage: {
        provider: 'memory'
      },
      logger: {
        console: { transport: 'console', level: 'debug' }
      },
      extensions: {
        express: {
          enabled: false
        },
        scripts: {
          timeout: 40000
        }
      },
      templatingEngines: {
        timeout: 10000
      },
      chrome: {
        timeout: 40000
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
        createExamples: false
      })
    )

    const result = await configure({
      context: {
        cwd: pathToTempProject
      }
    })
    const expectedConfig = {
      renderingSource: 'untrusted',
      store: {
        provider: 'memory'
      },
      blobStorage: {
        provider: 'memory'
      },
      logger: {
        console: { transport: 'console', level: 'debug' }
      },
      extensions: {
        express: {
          enabled: false
        },
        scripts: {
          timeout: 40000
        }
      },
      templatingEngines: {
        timeout: 10000
      },
      chrome: {
        timeout: 40000
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
        createExamples: true,
        fastStrategies: true
      })
    )

    const result = await configure({
      context: {
        cwd: pathToTempProject
      }
    })

    const expectedConfig = {
      httpPort: 7500,
      renderingSource: 'trusted',
      extensions: {
        authentication: {
          cookieSession: { secret: 'secret here' },
          admin: { username: 'test', password: 'test-pass' },
          enabled: true
        },
        scripts: {
          timeout: 40000,
          strategy: 'http-server'
        },
        'sample-template': {
          createSamples: true
        }
      },
      store: {
        provider: 'fs'
      },
      blobStorage: {
        provider: 'fs'
      },
      chrome: {
        timeout: 40000
      },
      logger: {
        console: { transport: 'console', level: 'debug' },
        file: { transport: 'file', level: 'info', filename: 'logs/reporter.log' },
        error: { transport: 'file', level: 'error', filename: 'logs/error.log' }
      },
      templatingEngines: {
        timeout: 10000,
        strategy: 'http-server'
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
      renderingSource: 'untrusted',
      store: {
        provider: 'memory'
      },
      blobStorage: {
        provider: 'memory'
      },
      logger: {
        console: { transport: 'console', level: 'debug' }
      },
      templatingEngines: {
        timeout: 10000
      },
      chrome: {
        timeout: 40000
      },
      extensions: {
        express: {
          enabled: false
        },
        scripts: {
          timeout: 40000
        }
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
