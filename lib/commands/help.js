'use strict'

const cliui = require('cliui')
const chalk = require('chalk')
const omit = require('lodash.omit')

const description = 'Prints information about a command or topic'
const command = 'help'

exports.command = command
exports.description = description

function getExamples (command) {
  return [
    [`${command} render`, `Print information about the render command`],
    [`${command} start`, `Print information about the start command`],
    [`${command} config`, `Print information about jsreport configuration input format`]
  ]
}

exports.builder = (yargs) => {
  const examples = getExamples('jsreport ' + command)

  examples.forEach((examp) => {
    yargs.example(examp[0], examp[1])
  })

  return (
    yargs.usage([
      `${description}\n`,
      `Usage: jsreport ${command} <commandOrTopic>\n`,
      `topics avaliable:\n`,
      `config -> print details about the configuration shape and types that the current jsreport instance in project supports\n`
    ].join('\n'))
  )
}

exports.handler = async (argv) => {
  const context = argv.context
  const verbose = argv.verbose
  const cwd = context.cwd
  const getInstance = context.getInstance
  const initInstance = context.initInstance
  let commandOrTopic
  let helpResult

  if (argv._ && argv._[1]) {
    commandOrTopic = argv._[1]
  }

  if (!commandOrTopic) {
    return onCriticalError(new Error('no "commandOrTopic" argument passed'))
  }

  const getCommandHelp = context.getCommandHelp

  if (commandOrTopic === 'config') {
    if (verbose) {
      console.log(`searching information about "${commandOrTopic}" as topic`)
    }

    let jsreportInstance

    try {
      // look up for an instance in CWD
      const _instance = await getInstance(cwd)

      if (verbose) {
        console.log('disabling express extension..')
      }

      if (typeof _instance === 'function') {
        jsreportInstance = _instance()
      } else {
        jsreportInstance = _instance
      }

      jsreportInstance.options = jsreportInstance.options || {}
      jsreportInstance.options.extensions = jsreportInstance.options.extensions || {}
      jsreportInstance.options.extensions.express = Object.assign(
        {},
        jsreportInstance.options.extensions.express,
        { start: false }
      )

      await initInstance(jsreportInstance)
    } catch (e) {
      return onCriticalError(e)
    }

    try {
      helpResult = schemaToConfigFormat(jsreportInstance.optionsValidator.getRootSchema())
    } catch (e) {
      return onCriticalError(e)
    }
  } else {
    if (verbose) {
      console.log(`searching information about "${commandOrTopic}" as command`)
    }

    try {
      helpResult = getCommandHelp(commandOrTopic, context)
    } catch (e) {
      if (e.notFound !== true) {
        return onCriticalError(e)
      }
    }

    if (helpResult) {
      helpResult = { output: helpResult.output }
    }
  }

  if (!helpResult) {
    return console.log(`no information found for command or topic "${commandOrTopic}"`)
  }

  console.log(helpResult.output)

  return helpResult
}

function onCriticalError (err) {
  const errorToPass = new Error(`An error occurred while trying to execute the command: ${err.message}`)
  errorToPass.originalError = err.originalError || err
  throw errorToPass
}

function schemaToConfigFormat (rootSchema) {
  const rawUI = cliui()
  const outputUI = cliui()

  function convert (ui, addStyles = true) {
    try {
      ui.div({
        text: 'Configuration format description for local jsreport instance:',
        padding: [0, 0, 1, 0]
      })

      ui.div('{')

      printProperties(ui, rootSchema.properties, { addStyles })

      ui.div('}')

      return ui.toString()
    } catch (e) {
      e.message = `A problem happened while trying to convert schema to help description. ${e.message}`
      throw e
    }
  }

  const results = {}
  const toConvert = [rawUI, outputUI]

  toConvert.forEach((ui, idx) => {
    if (idx === 0) {
      results['raw'] = convert(ui, false)
    } else {
      results['output'] = convert(ui)
    }
  })

  return results
}

function printProperties (ui, props, { level = 1, printRestProps = false, addStyles = true }) {
  let baseLeftPadding = level === 1 ? 2 : 3

  const knowProps = [
    'type', 'properties', 'items', 'not', 'anyOf', 'allOf', 'oneOf', 'default', 'enum',
    'format', 'pattern', 'description', 'title', '$jsreport-constantOrArray'
  ]

  if (props == null) {
    return
  }

  let bold

  if (addStyles) {
    bold = chalk.bold
  } else {
    bold = (i) => i
  }

  const propsKeys = Array.isArray(props) ? props : Object.keys(props)
  const totalKeys = propsKeys.length

  propsKeys.forEach((key, index) => {
    const isLastKey = index === totalKeys - 1
    let propName
    let schema
    let customCase

    if (Array.isArray(key)) {
      propName = key[0]
      schema = key[1]
    } else {
      propName = key
      schema = props[propName]
    }

    let shouldAddTopPadding = true

    if (index === 0 && level === 1) {
      shouldAddTopPadding = false
    }

    const getPadding = (l) => {
      return [shouldAddTopPadding ? 1 : 0, 0, 0, l * baseLeftPadding]
    }

    const content = {
      padding: getPadding(level)
    }

    if (propName !== '') {
      content.text = `"${bold(propName)}":`
    } else {
      content.text = '-'
    }

    if (schema.type) {
      let type = schema.type

      if (Array.isArray(type)) {
        type = type.join(' | ')
      } else if (type === 'array' && schema.items && schema.items.type) {
        type = Array.isArray(schema.items.type) ? schema.items.type.join(' | ') : schema.items.type
        type = `array<${type}>`
      }

      content.text += ` <${bold(type)}>`
    } else {
      if (schema.not != null && typeof schema.not === 'object') {
        content.text += ` <${bold('any type that is not valid against the description below')}>`
        customCase = 'not'
      } else if (Array.isArray(schema.anyOf)) {
        content.text += ` <${bold('any type that is valid against at least with one of the descriptions below')}>`
        customCase = 'anyOf'
      } else if (Array.isArray(schema.allOf)) {
        content.text += ` <${bold('any type that is valid against all the descriptions below')}>`
        customCase = 'allOf'
      } else if (Array.isArray(schema.oneOf)) {
        content.text += ` <${bold('any type that is valid against just one of the descriptions below')}>`
        customCase = 'oneOf'
      } else {
        // only schemas structures that are not implemented gets printed in raw form,
        // this means that we should analize the raw schema printed and then support it
        content.text += ` <raw schema: ${JSON.stringify(schema)}>`
      }
    }

    if (schema.default !== undefined) {
      content.text += ` (default: ${bold(JSON.stringify(schema.default))})`
    }

    let allowed

    if (schema.enum != null) {
      allowed = schema.enum
    } else if (schema.type === 'string' && schema['$jsreport-constantOrArray'] != null) {
      allowed = schema['$jsreport-constantOrArray']
    }

    if (Array.isArray(allowed) && allowed.length > 0) {
      content.text += ` (allowed values: ${bold(allowed.map((value) => {
        return JSON.stringify(value)
      }).join(', '))})`
    }

    if (
      typeof schema.type === 'string' ||
      (Array.isArray(schema.type) && schema.type.indexOf('string') !== -1)
    ) {
      if (schema.format != null) {
        content.text += ` (format: ${schema.format})`
      }

      if (schema.pattern != null) {
        content.text += ` (pattern: ${schema.pattern})`
      }
    }

    if (printRestProps) {
      const restProps = omit(schema, knowProps)

      if (restProps && Object.keys(restProps).length > 0) {
        content.text += ` (raw schema: ${JSON.stringify(restProps)})`
      }
    }

    if (schema.description != null) {
      content.text += ` -> ${schema.description}`
    }

    if (
      schema.type === 'object' &&
      schema.properties != null &&
      Object.keys(schema.properties).length > 0
    ) {
      content.text += ` {`
    } else if (
      schema.type === 'array' &&
      (Array.isArray(schema.items) ||
      (schema.items &&
      schema.items.type &&
      schema.items.type === 'object' &&
      schema.items.properties != null &&
      Object.keys(schema.items.properties).length > 0))
    ) {
      content.text += ` [`
    } else if (!isLastKey && propName !== '') {
      content.text += `,`
    }

    ui.div(content)

    if (customCase != null) {
      if (customCase === 'not') {
        printProperties(ui, [['', schema.not]], { level: level + 1 })
      } else if (
        (customCase === 'anyOf' ||
        customCase === 'allOf' ||
        customCase === 'oneOf') &&
        Array.isArray(schema[customCase]) &&
        schema[customCase].length > 0
      ) {
        printProperties(ui, schema[customCase].map((s) => {
          return ['', s]
        }), { level: level + 1, printRestProps: true })
      }
    } else if (
      schema.type === 'object' &&
      schema.properties != null &&
      Object.keys(schema.properties).length > 0
    ) {
      printProperties(ui, schema.properties, { level: level + 1 })
      ui.div({ text: `}${!isLastKey ? ',' : ''}`, padding: content.padding })
    } else if (
      schema.type === 'array' &&
      schema.items &&
      schema.items.type === 'object' &&
      schema.items.properties != null &&
      Object.keys(schema.items.properties).length > 0
    ) {
      ui.div({ text: `{`, padding: getPadding(level + 1) })
      printProperties(ui, schema.items.properties, { level: level + 2 })
      ui.div({ text: `{`, padding: getPadding(level + 1) })
      ui.div({ text: `]${!isLastKey ? ',' : ''}`, padding: content.padding })
    } else if (schema.type === 'array' && Array.isArray(schema.items)) {
      printProperties(ui, schema.items.map((s, idx) => {
        return [`item at ${idx} index should be`, s]
      }), { level: level + 1 })
      ui.div({ text: `]${!isLastKey ? ',' : ''}`, padding: content.padding })
    }
  })
}
