'use strict'

function formatError (err) {
  return err.message || ''
}

function getErrorMessages (err) {
  let parent = err
  let count = 0
  let cleanState = false
  const messages = []
  const stacks = []

  // first loop just to get the final count of errors
  while (parent != null) {
    count++
    parent = parent.originalError
  }

  parent = err

  while (parent != null) {
    let customProps = Object.assign({}, parent)
    let currentStack = parent.stack || ''

    if (!cleanState && parent.cleanState === true) {
      cleanState = true
    }

    // making sure custom props like "originalError", "cleanState" are not part of meta
    delete customProps.originalError
    delete customProps.cleanState

    customProps = JSON.stringify(customProps)

    if (cleanState) {
      messages.push(`${formatError(parent)}`)
    } else {
      messages.push(`${formatError(parent)} (${count})`)
    }

    currentStack = currentStack.replace(parent.message, '')

    if (customProps === '{}') {
      customProps = ''
    }

    if (currentStack !== '') {
      let causedBy = `caused by error (${count})`

      if (customProps !== '') {
        stacks.push(`${causedBy} -> meta = ${customProps}, stack = ${currentStack}`)
      } else {
        stacks.push(`${causedBy} -> stack = ${currentStack}`)
      }
    }

    parent = parent.originalError
    count--
  }

  if (!cleanState && stacks.length > 0) {
    messages.push(`\n${stacks.join('\n')}`)
  }

  return messages
}

function printErrorAndExit (err, exit) {
  const messages = getErrorMessages(err)

  console.error(messages.join('. '))

  if (exit === false) {
    return
  }

  process.exit(1)
}

module.exports.printErrorAndExit = printErrorAndExit
module.exports.getErrorMessages = getErrorMessages
