'use strict'

const path = require('path')
const fs = require('fs')
const platform = require('os').platform()
const Winser = require('winser-with-api').Winser

const description = 'WINDOWS ONLY - Stop and uninstall service'
const command = 'win-uninstall'

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
    let pathToApp
    let serviceName
    let customError

    logger.info('Platform is ' + platform)

    if (platform !== 'win32') {
      logger.info('Unstalling windows service for app only works on windows platforms..')

      return resolve({
        uninstalled: false,
        serviceName: null
      })
    }

    if (!existsPackageJson && !appInfo) {
      customError = new Error('To uninstall windows service for app you need a package.json file')
      customError.cleanState = true
      return reject(customError)
    }

    if (appInfo) {
      if (!appInfo.path) {
        customError = new Error('To uninstall windows service for app you need to pass "path" in appInfo')
        customError.cleanState = true
        return reject(customError)
      }

      pathToApp = appInfo.path

      if (!appInfo.name) {
        customError = new Error('To uninstall windows service for app you need to pass "name" in appInfo')
        customError.cleanState = true
        return reject(customError)
      }

      serviceName = appInfo.name
    } else {
      pathToApp = cwd

      const userPkg = require(path.join(pathToApp, './package.json'))

      if (!userPkg.name) {
        customError = new Error('To uninstall windows service for app you need a "name" field in package.json file')
        customError.cleanState = true
        return reject(customError)
      }

      serviceName = userPkg.name
    }

    logger.info('Uninstalling windows service "' + serviceName + '".')

    let winser

    if (appInfo) {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm, app: appInfo })
    } else {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })
    }

    winser.remove({
      path: pathToApp,
      stop: true
    }, (error) => {
      if (error) {
        error.message = `Error while trying to uninstall windows service: ${error.message}`
        return reject(error)
      }

      logger.info('Windows service "' + serviceName + '" uninstalled')

      resolve({
        uninstalled: true,
        serviceName: serviceName
      })
    })
  })
}
