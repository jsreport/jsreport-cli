'use strict'

const util = require('util')
const path = require('path')
const fs = require('fs')
const pathIsAbsolute = require('path-is-absolute')
const jsreportClient = require('jsreport-client')
const keepAliveProcess = require('../keepAliveProcess')
const daemonHandler = require('../daemonHandler')

const writeFileAsync = util.promisify(fs.writeFile)
const findProcessByCWD = util.promisify(daemonHandler.findProcessByCWD)

const description = 'Invoke a rendering process'
const command = 'render'

exports.command = command
exports.description = description

exports.builder = (yargs) => {
  const commandOptions = {
    request: {
      alias: 'r',
      description: 'Specifies a path to a json file containing option for the entire rendering request',
      requiresArg: true,
      coerce: (value) => {
        return normalizePathOption('request', value, { json: true, strict: true })
      }
    },
    keepAlive: {
      alias: 'k',
      description: 'Specifies that the process should stay open (handled by the maintainer) for future renders',
      type: 'boolean'
    },
    template: {
      alias: 't',
      description: 'Specifies a path to a json file containing options for template input or you can specify singular options doing --template.[option_name] value',
      requiresArg: true,
      coerce: (value) => {
        if (typeof value !== 'string') {
          if (value.content != null) {
            value.content = normalizePathOption('template.content', value.content, { strict: true })
          }

          if (value.helpers != null) {
            value.helpers = normalizePathOption('template.helpers', value.helpers, { strict: true })
          }

          return value
        }

        return normalizePathOption('template', value, { json: true, strict: true })
      }
    },
    data: {
      alias: 'd',
      description: 'Specifies a path to a json file containing options for data input',
      requiresArg: true,
      coerce: (value) => {
        return normalizePathOption('data', value, { json: true, strict: false })
      }
    },
    out: {
      alias: 'o',
      description: 'Save rendering result into a file path',
      type: 'string',
      demandOption: true,
      requiresArg: true,
      coerce: (value) => {
        return normalizePathOption('out', value, { read: false, strict: true })
      }
    },
    meta: {
      alias: 'm',
      description: 'Save response meta information into a file path',
      type: 'string',
      demandOption: false,
      requiresArg: true,
      coerce: (value) => {
        return normalizePathOption('meta', value, { read: false, strict: true })
      }
    }
  }

  const options = Object.keys(commandOptions)

  const examples = getExamples('jsreport ' + command)

  examples.forEach((examp) => {
    yargs.example(examp[0], examp[1])
  })

  return (
    yargs
      .usage(`${description}\n\n${getUsage('jsreport ' + command)}`)
      .group(options, 'Command options:')
      .options(commandOptions)
      .check((argv, hash) => {
        if (argv.user && !argv.serverUrl) {
          throw new Error('user option needs to be used with --serverUrl option')
        }

        if (argv.password && !argv.serverUrl) {
          throw new Error('password option needs to be used with --serverUrl option')
        }

        if (argv.user && !argv.password) {
          throw new Error('user option needs to be used with --password option')
        }

        if (argv.password && !argv.user) {
          throw new Error('password option needs to be used with --user option')
        }

        if (!argv.request && !argv.template) {
          throw new Error('render command need at least --request or --template option')
        }

        return true
      })
  )
}

exports.configuration = {
  globalOptions: ['serverUrl', 'user', 'password']
}

exports.handler = async (argv) => {
  const output = argv.out
  const meta = argv.meta
  const context = argv.context
  const verbose = argv.verbose
  const options = getOptions(argv)

  // connect to a remote server
  if (argv.serverUrl) {
    console.log('starting rendering process in ' + argv.serverUrl + '..')

    try {
      const result = await startRender(null, {
        verbose: verbose,
        request: options.render,
        meta: meta,
        output: output,
        remote: options.remote
      })
      result.fromRemote = true
      return result
    } catch (e) {
      return onCriticalError(e)
    }
  }

  const cwd = context.cwd
  const sockPath = context.sockPath
  const workerSockPath = context.workerSockPath
  const getInstance = context.getInstance
  const initInstance = context.initInstance
  const daemonExec = context.daemonExec

  if (verbose) {
    console.log('looking for previously daemonized instance in:', workerSockPath, 'cwd:', cwd)
  }

  // first, try to look up if there is an existing process
  // "daemonized" before in the CWD
  let processInfo
  try {
    processInfo = await findProcessByCWD(workerSockPath, cwd)
  } catch (processLookupErr) {
    return onCriticalError(processLookupErr, true)
  }

  // if process was found, just connect to it,
  // otherwise just continue processing
  if (processInfo) {
    if (verbose) {
      console.log('using instance daemonized previously (pid: ' + processInfo.pid + ')..')
    }

    const adminAuthentication = processInfo.adminAuthentication || {}

    try {
      const result = await startRender(null, {
        verbose: verbose,
        request: options.render,
        output: output,
        meta: meta,
        remote: {
          url: processInfo.url,
          user: adminAuthentication.username,
          password: adminAuthentication.password
        }
      })

      result.fromDaemon = true
      return result
    } catch (e) {
      return onCriticalError(e)
    }
  }

  if (verbose) {
    console.log('there is no previously daemonized instance in:', workerSockPath, 'cwd:', cwd)
  }

  // start a new daemonized process and then connect to it
  // to render
  if (argv.keepAlive) {
    let childProc

    try {
      const processInfo = await keepAliveProcess({
        daemonExec: daemonExec,
        mainSockPath: sockPath,
        workerSockPath: workerSockPath,
        cwd: cwd,
        verbose: verbose
      })
      const remoteUrl = processInfo.url
      const adminAuthentication = processInfo.adminAuthentication || {}

      console.log('instance has been daemonized and initialized successfully (pid: ' + processInfo.proc.pid + ')')
      childProc = processInfo.proc

      const result = await startRender(null, {
        verbose: verbose,
        request: options.render,
        output: output,
        meta: meta,
        remote: {
          url: remoteUrl,
          user: adminAuthentication.username,
          password: adminAuthentication.password
        }
      })

      // make sure to unref() the child process after the first render
      // to allow the exit of the current process
      childProc.unref()

      result.daemonProcess = processInfo
      result.fromDaemon = true

      return result
    } catch (err) {
      if (childProc) {
        childProc.unref()
      }
      return onCriticalError(err)
    }
  }

  try {
  // look up for an instance in CWD
    const _instance = await getInstance(cwd)
    let jsreportInstance

    if (verbose) {
      console.log('disabling express extension..')
    }

    if (typeof _instance === 'function') {
      jsreportInstance = _instance()
    } else {
      jsreportInstance = _instance
    }

    jsreportInstance.options = jsreportInstance.options || {}
    jsreportInstance.options.express = Object.assign({}, jsreportInstance.options.express, { enabled: false })

    await initInstance(jsreportInstance)

    console.log('starting rendering process..')

    if (verbose) {
      console.log('Output configured to:', output)
    }

    return (await startRender(jsreportInstance, {
      verbose: verbose,
      request: options.render,
      output: output,
      meta: meta
    }))
  } catch (e) {
    return onCriticalError(e)
  }

  function onCriticalError (err, notThrow) {
    const errorToPass = new Error('An error occurred while trying to execute the command:' + err.message)
    errorToPass.originalError = err.originalError || err

    if (notThrow === true) {
      return errorToPass
    }

    throw errorToPass
  }
}

async function startRender (jsreportInstance, { remote, request, output, meta, verbose }) {
  if (verbose) {
    if (remote) {
      console.log('remote server options:')
      console.log(remote)
    }

    console.log('rendering with options:')
    console.log(JSON.stringify(request, null, 2))
  }

  if (remote) {
    try {
      const response = await jsreportClient(remote.url, remote.user, remote.password).render(request)
      return (await saveResponse(response, response.headers, output, meta))
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw onRenderingError(
          new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
            ', Please verify that a jsreport server is running')
        )
      }

      if (err.response && err.response.statusCode != null) {
        if (err.response.statusCode === 404) {
          throw onRenderingError(
            new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
              ', Please verify that a jsreport server is running')
          )
        } else if (err.response.statusCode === 401) {
          throw onRenderingError(
            new Error('Couldn\'t connect to remote jsreport server in: ' + remote.url +
              ' Authentication error, Please pass correct --user and --password options')
          )
        }
      }

      throw err
    }
  }

  try {
    const out = await jsreportInstance.render(request)
    return (await saveResponse(out.stream, out.headers, output, meta))
  } catch (err) {
    throw onRenderingError(err)
  }
}

async function saveResponse (stream, headers, output, meta) {
  const outputStream = writeFileFromStream(stream, output)

  return new Promise((resolve, reject) => {
    listenOutputStream(outputStream, () => {
      if (!meta) {
        return resolve({
          output: output
        })
      }

      writeFileAsync(meta, JSON.stringify(responseHeadersToMetaPOCO(headers)), 'utf8', (err) => {
        if (err) {
          return reject(onRenderingError(err))
        }

        resolve({
          output: output,
          meta: meta
        })
      })
    }, reject)
  })
}

function responseHeadersToMetaPOCO (headers) {
  const meta = {}

  for (let property in headers) {
    if (headers.hasOwnProperty(property)) {
      const val = headers[property]
      let p = property.replace(/-.{1}/g, (s) => s[1].toUpperCase())

      p = p[0].toLowerCase() + p.substring(1)
      meta[p] = val
    }
  }

  return meta
}

function listenOutputStream (outputStream, onFinish, onError) {
  outputStream.on('finish', () => {
    console.log('rendering has finished successfully and saved in:', outputStream.path)
    onFinish()
  })

  outputStream.on('error', (err) => {
    onError(onRenderingError(err))
  })
}

function writeFileFromStream (stream, output) {
  const outputStream = fs.createWriteStream(output)

  stream.pipe(outputStream)

  return outputStream
}

function onRenderingError (error) {
  console.error('rendering has finished with errors:')
  return error
}

function getOptions (argv) {
  const renderingOpts = argv.request || {}
  let remote = null

  if (argv.serverUrl) {
    remote = {
      url: argv.serverUrl
    }
  }

  if (argv.user && argv.serverUrl) {
    remote.user = argv.user
  }

  if (argv.password && argv.serverUrl) {
    remote.password = argv.password
  }

  if (argv.template) {
    renderingOpts.template = Object.assign({}, renderingOpts.template, argv.template)
  }

  if (argv.data) {
    renderingOpts.data = Object.assign({}, renderingOpts.data, argv.data)
  }

  return {
    render: renderingOpts,
    remote: remote
  }
}

function normalizePathOption (optionName, value, options) {
  if (typeof value === 'string') {
    const pathVal = path.resolve(process.cwd(), value)

    if (options.strict) {
      if (!pathIsAbsolute(pathVal)) {
        throw new Error(optionName + ' option must be a valid file path')
      }
    }

    const read = options.read != null ? options.read : true
    if (!read) {
      return pathVal
    }

    try {
      if (options.json) {
        return JSON.parse(fs.readFileSync(pathVal).toString())
      } else {
        return fs.readFileSync(pathVal).toString()
      }
    } catch (e) {
      if (options.json) {
        throw new Error('file in ' + pathVal + ' doesn\'t have a valid JSON content')
      }

      throw new Error('can\'t read file in ' + pathVal)
    }
  }

  if (options.strictict) {
    throw new Error(optionName + ' option must be a file path')
  }

  return value
}

function getUsage (command) {
  return [
    `Usage: ${command} --request <file> --out <file>`,
    `${command} --template <file> --out <file>`,
    `${command} --template <file> --data <file> --out <file>`,
    `${command} --template <file> --out <file> --meta <file>`
  ].join('\n')
}

function getExamples (command) {
  return [
    [`${command} --request request.json --out output.pdf`, `Start rendering with options in request.json`],
    [`${command} --template template.json --out output.pdf`, `Start rendering with options for template input in template.json`],
    [`${command} --template.recipe phantom-pdf --template.engine handlebars --template.content template.html --out output.pdf`, `Start rendering with inline options for template input`],
    [`${command} --template template.json --data data.json --out output.pdf`, `Start rendering with options for template and data input`]
  ]
}
