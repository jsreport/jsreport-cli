'use strict'

const searchExtensionsCommands = require('./registerExtensionsCommands')

module.exports = (reporter, definition) => {
  reporter.cli = {
    findCommandsInExtensions: async () => {
      const extensionsCommands = await searchExtensionsCommands(
        reporter.extensionsManager.extensions,
        { registerCommand: () => {} }
      )

      return extensionsCommands
    }
  }
}
