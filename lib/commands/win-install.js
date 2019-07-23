'use strict'

const path = require('path')
const fs = require('fs')
const platform = require('os').platform()
const Winser = require('winser-with-api').Winser

const description = 'WINDOWS ONLY - install app as windows service, For other platforms see http://jsreport.net/on-prem/downloads'
const command = 'win-install'

exports.command = command
exports.description = description

exports.handler = (argv) => {
  return new Promise((resolve, reject) => {
    const verbose = argv.verbose
    const context = argv.context
    const logger = context.logger
    const cwd = context.cwd
    const staticPaths = context.staticPaths || {}
    const appInfo = context.appInfo
    const existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    let hasEntry = false
    let pathToApp
    let serviceName
    let customError

    logger.info('Platform is ' + platform)

    if (platform !== 'win32') {
      logger.info('Installing app as windows service only works on windows platforms..')
      logger.info('Installing jsreport as startup service for your platform should be described at http://jsreport.net/downloads')

      return resolve({
        installed: false,
        serviceName: null
      })
    }

    if (!existsPackageJson && !appInfo) {
      customError = new Error('To install app as windows service you need a package.json file')
      customError.cleanState = true
      return reject(customError)
    }

    if (appInfo) {
      if (!appInfo.path) {
        customError = new Error('To install app as windows service you need to pass "path" in appInfo')
        customError.cleanState = true
        return reject(customError)
      }

      pathToApp = appInfo.path

      if (!appInfo.name) {
        customError = new Error('To install app as windows service you need to pass "name" in appInfo')
        customError.cleanState = true
        return reject(customError)
      }

      serviceName = appInfo.name

      if (appInfo.startcmd) {
        hasEntry = true
      }

      if (!hasEntry) {
        customError = new Error('To install app as windows service you need to pass "startcmd" in appInfo')
        customError.cleanState = true
        return reject(customError)
      }
    } else {
      pathToApp = cwd

      const userPkg = require(path.join(pathToApp, './package.json'))

      if (!userPkg.name) {
        customError = new Error('To install app as windows service you need a "name" field in package.json file')
        customError.cleanState = true
        return reject(customError)
      }

      serviceName = userPkg.name

      if (userPkg.scripts && userPkg.scripts.start) {
        hasEntry = true
      } else if (userPkg.main) {
        hasEntry = true
      }

      if (!hasEntry) {
        customError = new Error('To install app as windows service you need to have a "start" script or a "main" field in package.json file')
        customError.cleanState = true
        return reject(customError)
      }
    }

    logger.info('Installing windows service "' + serviceName + '" for app..')

    let winser

    if (appInfo) {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm, app: appInfo })
    } else {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })
    }

    winser.install({
      path: pathToApp,
      env: ['NODE_ENV=' + (process.env.NODE_ENV != null ? process.env.NODE_ENV : 'development')],
      autostart: true
    }, (error) => {
      if (error) {
        error.message = `Error while trying to install windows service: ${error.message}`
        return reject(error)
      }

      logger.info('Service "' + serviceName + '" is running.')

      resolve({
        installed: true,
        serviceName: serviceName
      })
    })
  })
}
