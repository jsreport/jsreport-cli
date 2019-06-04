'use strict'

const util = require('util')
const path = require('path')
const fs = require('fs')
const accessAsync = util.promisify(fs.access)

module.exports = async (extensions, commander) => {
  const results = []

  await Promise.all(extensions.map(async (ext) => {
    try {
      const extCliPath = path.join(ext.directory, 'cli/main.js')
      let extCliExport

      if (ext.cliModule === false) {
        return
      }

      if (ext.cliModule) {
        extCliExport = ext.cliModule
      } else {
        let hasCli = false

        try {
          await accessAsync(extCliPath)
          hasCli = true
        } catch (e) {}

        if (!hasCli) {
          return
        }

        extCliExport = require(extCliPath)
      }

      if (!extCliExport) {
        return
      }

      if (Array.isArray(extCliExport)) {
        results.push({
          extension: ext.name,
          cliModulePath: extCliPath,
          commands: extCliExport
        })

        extCliExport.forEach((commandModule) => commander.registerCommand(commandModule))
      } else {
        results.push({
          extension: ext.name,
          cliModulePath: extCliPath,
          commands: [extCliExport]
        })

        commander.registerCommand(extCliExport)
      }
    } catch (e) {
      const err = new Error(`Error while trying to register cli command in extension "${ext.name}". reason: ${e.message}`)

      err.stack = e.stack

      throw err
    }
  }))

  return results
}
