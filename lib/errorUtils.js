'use strict'

function formatError (err) {
  const message = (err.stack || err.message) || ''

  return message + ' ' + JSON.stringify(err)
}

function getErrorMessages (err) {
  let parent = err
  const messages = []

  while (parent != null) {
    if (parent === err) {
      messages.push(formatError(parent))
    } else {
      messages.push(`(Original) ${formatError(parent)}`)
    }

    parent = parent.originalError
  }

  return messages
}

function printErrorAndExit (err, exit) {
  const errorMessages = getErrorMessages(err)

  errorMessages.forEach((errMsg) => {
    console.error(errMsg)
  })

  if (exit === false) {
    return
  }

  process.exit(1)
}

module.exports.printErrorAndExit = printErrorAndExit
module.exports.getErrorMessages = getErrorMessages
