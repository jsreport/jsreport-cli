'use strict'

const path = require('path')
const fs = require('fs')
const install = require('npm-install-package')

function initializeApp (cwd, logger, force, selectedVersion, customInstall) {
  return new Promise((resolve, reject) => {
    const existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    let isMainJsreport = false

    checkOrInstallJsreport(cwd, logger, existsPackageJson, selectedVersion, customInstall, (err, jsreportPkgInfo) => {
      if (err) {
        err.message = `Unexpected error happened: ${err.message}`
        return reject(err)
      }

      isMainJsreport = (jsreportPkgInfo.name === 'jsreport')

      if (!fs.existsSync(path.join(cwd, './server.js')) || force) {
        logger.info('Creating server.js')
        fs.writeFileSync(
          path.join(cwd, './server.js'),
          fs.readFileSync(
            path.join(__dirname, '../../example.server.js')
          ).toString().replace('$moduleName$', jsreportPkgInfo.name)
        )
      }

      if (!existsPackageJson || force) {
        logger.info('Creating package.json')

        const serverPackageJson = {
          'name': 'jsreport-server',
          'main': 'server.js',
          'scripts': {
            'start': 'node server'
          },
          'jsreport': {
            'entryPoint': 'server.js'
          },
          'dependencies': {
          }
        }

        serverPackageJson.dependencies[jsreportPkgInfo.name] = jsreportPkgInfo.version

        if (isMainJsreport) {
          serverPackageJson.scripts.jsreport = 'jsreport'
        }

        fs.writeFileSync(path.join(cwd, './package.json'), JSON.stringify(serverPackageJson, null, 2))
      }

      if ((!fs.existsSync(path.join(cwd, './jsreport.config.json')) || force) && isMainJsreport) {
        logger.info('Creating default config jsreport.config.json')
        fs.writeFileSync(path.join(cwd, './jsreport.config.json'), fs.readFileSync(path.join(__dirname, '../../example.config.json')))
      }

      logger.info('Initialized')

      resolve({
        name: jsreportPkgInfo.name,
        version: jsreportPkgInfo.version
      })
    })
  })
}

function checkOrInstallJsreport (cwd, logger, existsPackageJson, version, customInstall, cb) {
  let detectedJsreport
  let detectedVersion
  const originalCWD = process.cwd()

  if (existsPackageJson) {
    const userPkg = require(path.join(cwd, './package.json'))
    const userDependencies = userPkg.dependencies || {}

    if (userDependencies['jsreport']) {
      detectedJsreport = 'jsreport'
      detectedVersion = userDependencies['jsreport']
    } else if (userDependencies['jsreport-core']) {
      detectedJsreport = 'jsreport-core'
      detectedVersion = userDependencies['jsreport-core']
    }
  }

  if (!detectedJsreport) {
    if (fs.existsSync(path.join(cwd, 'node_modules/jsreport'))) {
      detectedJsreport = 'jsreport'
    } else if (fs.existsSync(path.join(cwd, 'node_modules/jsreport-core'))) {
      detectedJsreport = 'jsreport-core'
    }

    if (detectedJsreport) {
      try {
        detectedVersion = requireJsreportPkg(cwd, detectedJsreport).version
      } catch (e) {
        return cb(e)
      }
    }
  }

  if (!detectedJsreport) {
    let versionToInstall

    detectedJsreport = 'jsreport'

    if (version) {
      versionToInstall = 'jsreport@' + version
      logger.info('jsreport installation not found, installing ' + detectedJsreport + '@' + version + ' version now, wait a moment...')
    } else {
      versionToInstall = 'jsreport'
      logger.info('jsreport installation not found, installing ' + detectedJsreport + ' latest version now, wait a moment...')
    }

    process.chdir(cwd)

    // creating basic package.json in order to make npm install
    // work normally in current directory, later the real package.json
    // will be created
    if (!existsPackageJson) {
      fs.writeFileSync(
        path.join(cwd, './package.json'),
        JSON.stringify({
          name: 'jsreport-server'
        }, null, 2))
    }

    const runInstall = customInstall != null ? customInstall : install

    runInstall(versionToInstall, { save: true }, (installErr) => {
      process.chdir(originalCWD)

      if (installErr) {
        return cb(installErr)
      }

      logger.info('jsreport installation finished..')

      try {
        detectedVersion = requireJsreportPkg(cwd, detectedJsreport).version
      } catch (e) {
        return cb(e)
      }

      cb(null, {
        name: detectedJsreport,
        version: detectedVersion
      })
    })
  } else {
    cb(null, {
      name: detectedJsreport,
      version: detectedVersion
    })
  }
}

function requireJsreportPkg (cwd, jsreportPkgName) {
  try {
    const jsreportModule = require(path.join(cwd, 'node_modules/' + jsreportPkgName + '/package.json'))
    const jsreportVersion = jsreportModule.version

    return {
      name: jsreportPkgName,
      version: jsreportVersion
    }
  } catch (err) {
    const errorToReject = new Error(`problem while trying to require ${jsreportPkgName} package`)
    errorToReject.originalError = err
    throw errorToReject
  }
}

module.exports = initializeApp
