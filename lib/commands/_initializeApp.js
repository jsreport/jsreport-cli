'use strict'

var path = require('path')
var fs = require('fs')
var install = require('npm-install-package')

function initializeApp (force) {
  var existsPackageJson = fs.existsSync('package.json')
  var jsreportModule
  var jsreportVersion
  var isMainJsreport = false

  checkOrInstallJsreport(existsPackageJson, function (err, detectedJsreport) {
    if (err) {
      return console.log('Unexpected error happened,', err)
    }

    isMainJsreport = (detectedJsreport === 'jsreport')

    try {
      jsreportModule = require(path.join(require.resolve(detectedJsreport + '/package.json')))
      jsreportVersion = jsreportModule.version
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        return console.log('Unexpected error happened,', err)
      }

      // trying to read from top level node_modules
      try {
        jsreportModule = require(path.join(process.cwd(), 'node_modules/' + detectedJsreport + '/package.json'))
        jsreportVersion = jsreportModule.version
      } catch (e) {
        return console.log('Unexpected error happened,', e)
      }
    }

    if (!fs.existsSync('server.js') || force) {
      console.log('Creating server.js')
      fs.writeFileSync(
        'server.js',
        fs.readFileSync(
          path.join(__dirname, '../../example.server.js')
        ).toString().replace('$moduleName$', detectedJsreport)
      )
    }

    if (!existsPackageJson || force) {
      console.log('Creating package.json')

      var serverPackageJson = {
        'name': 'jsreport-server',
        'main': 'server.js',
        'scripts': {
          'start': 'node server'
        },
        'dependencies': {
        }
      }

      serverPackageJson.dependencies[detectedJsreport] = jsreportVersion

      if (isMainJsreport) {
        serverPackageJson.scripts.jsreport = 'jsreport'
      }

      fs.writeFileSync('package.json', JSON.stringify(serverPackageJson, null, 2))
    }

    if ((!fs.existsSync('prod.config.json') || force) && isMainJsreport) {
      console.log('Creating prod.config.json (applied on npm start --production)')
      fs.writeFileSync('prod.config.json', fs.readFileSync(path.join(__dirname, '../../example.config.json')))
      console.log('Creating dev.config.json (applied on npm start)')
      fs.writeFileSync('dev.config.json', fs.readFileSync(path.join(__dirname, '../../example.config.json')))
    }

    console.log('Initialized')
  })
}

function checkOrInstallJsreport (existsPackageJson, cb) {
  var detectedJsreport
  var userPkg
  var userDependencies

  if (existsPackageJson) {
    userPkg = require(path.join(process.cwd(), './package.json'))
    userDependencies = userPkg.dependencies || {}

    if (userDependencies['jsreport']) {
      detectedJsreport = 'jsreport'
    } else if (userDependencies['jsreport-core']) {
      detectedJsreport = 'jsreport-core'
    }
  }

  if (!detectedJsreport) {
    if (fs.existsSync(path.join(process.cwd(), 'node_modules/jsreport'))) {
      detectedJsreport = 'jsreport'
    } else if (fs.existsSync(path.join(process.cwd(), 'node_modules/jsreport-core'))) {
      detectedJsreport = 'jsreport-core'
    }
  }

  if (!detectedJsreport) {
    console.log('jsreport installation not found, intalling it now, wait a moment...')

    detectedJsreport = 'jsreport'

    install(detectedJsreport, function (installErr) {
      if (installErr) {
        return cb(installErr)
      }

      console.log('jsreport installation finished..')
      cb(null, detectedJsreport)
    })
  } else {
    cb(null, detectedJsreport)
  }
}

module.exports = initializeApp
