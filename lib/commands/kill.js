'use strict'

const description = 'Kill a daemon jsreport process'
const command = 'kill'

exports.command = command
exports.description = description

exports.builder = (yargs) => {
  return (
    yargs
      .usage(
        [
          `${description}\n`,
          `Usage:\n\njsreport ${command} [uidOrpid]\n`,
          'If uid or pid is not specified we will try to kill a daemon process that was started from CWD'
        ].join('\n')
      )
      .positional('uidOrpid', {
        type: 'string',
        description: 'Process id or uid of the instance to kill'
      })
  )
}

exports.handler = async (argv) => {
  const verbose = argv.verbose
  const context = argv.context
  const cwd = context.cwd
  const workerSockPath = context.workerSockPath
  const daemonHandler = context.daemonHandler

  let identifier
  let processInfo

  if (argv._ && argv._[1]) {
    identifier = argv._[1]
  }

  if (!identifier) {
    console.log('searching for daemon process in:', cwd)

    if (verbose) {
      console.log('looking for previously daemonized process in:', workerSockPath, 'cwd:', cwd)
    }

    processInfo = await daemonHandler.findProcessByCWD(workerSockPath, cwd)
  } else {
    console.log('searching for daemon process with id:', identifier)

    processInfo = await daemonHandler.findProcessByUidOrPid(workerSockPath, identifier)
  }

  if (!processInfo) {
    let customError

    if (!identifier) {
      customError = new Error(`there is no active daemon process in: ${cwd}`)
    } else {
      customError = new Error(`there is no active daemon with id: ${identifier}`)
    }

    // makes the cli to print clean error (without stack trace)
    customError.cleanState = true

    throw customError
  }

  if (verbose) {
    if (!identifier) {
      console.log('daemon process found in:', workerSockPath, 'cwd:', cwd, 'pid:', processInfo.pid)
    } else {
      console.log('daemon process found in:', workerSockPath, 'id:', identifier, 'pid:', processInfo.pid)
    }
  }

  if (verbose) {
    console.log('killing daemon process.. uid:', processInfo.uid, 'pid:', processInfo.pid)
  }

  try {
    await daemonHandler.kill(processInfo)

    console.log(`daemon process (pid: ${processInfo.pid}) killed successfully`)
  } catch (e) {
    e.message = `error while trying to kill daemon process: ${e.message}`
    throw e
  }

  return processInfo
}
