const path = require('path')
const fs = require('fs')
const execSync = require('child_process').execSync
const utils = require('../utils')
const cwd = path.join(__dirname, '..', 'temp', 'cli')

const originalDevConfig = {
  authentication: {
    cookieSession: {
      secret: '<your strong secret>'
    },
    admin: {
      username: 'admin',
      password: 'password'
    },
    enabled: false
  }
}

module.exports.exec = (cmd) => execSync(`${process.execPath}${process.env.debugCLI ? ' --inspect-brk' : ''} runner.js ${cmd}`, { env: { DEBUG: 'jsreport' }, cwd: cwd }).toString()
module.exports.cwd = cwd

let clean = module.exports.clean = function (done) {
  utils.cleanTempDir(['cli'])
  utils.createTempDir(['cli'], function (dir, absoluteDir) {
    fs.writeFileSync(
      path.join(absoluteDir, './package.json'),
      JSON.stringify({
        name: 'cli-project',
        dependencies: {
          jsreport: '*'
        },
        jsreport: {
          entryPoint: 'server.js'
        }
      }, null, 2)
    )

    fs.writeFileSync(
      path.join(absoluteDir, 'jsreport.config.json'),
      JSON.stringify(originalDevConfig, null, 2)
    )

    fs.writeFileSync(
      path.join(absoluteDir, 'runner.js'),
      `
      const commander = require('../../../lib/commander')(__dirname)
      commander.start(process.argv.slice(2))
      `
    )

    fs.writeFileSync(
      path.join(absoluteDir, './server.js'),
      [
        'const jsreport = require("jsreport")()',
        'if (require.main !== module) {',
        'module.exports = jsreport',
        '} else {',
        'jsreport.init().catch(function (e) {',
        'console.error("error on jsreport init")',
        'console.error(e.stack)',
        'process.exit(1)',
        '})',
        '}'
      ].join('\n')
    )

    done()
  })
}

module.exports.init = function (done) {
  this.timeout(0)

  clean(function () {
    utils.npmInstall(cwd, done)
  })
}
