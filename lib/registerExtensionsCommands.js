'use strict'

const util = require('util')
const path = require('path')
const fs = require('fs')
const accessAsync = util.promisify(fs.access)

module.exports = async (commander, extensions) => {
  await Promise.all(extensions.map(async (ext) => {
    let extCliExport

    if (ext.cliModule) {
      extCliExport = ext.cliModule
    } else {
      const extCliPath = path.join(ext.directory, 'cli/main.js')
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
      extCliExport.forEach((commandModule) => commander.registerCommand(commandModule))
    } else {
      commander.registerCommand(extCliExport)
    }
  }))
}
