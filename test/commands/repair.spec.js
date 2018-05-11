const path = require('path')
const fs = require('fs')
const should = require('should')
const jsreportVersionToTest = require('../jsreportVersionToTest')
const utils = require('../utils')
const repair = require('../../lib/commands/repair').handler

const TEMP_DIRS = [
  'repair-empty',
  'repair-with-specific-version',
  'repair-packagejson-only',
  'repair-packagejson-with-server',
  'repair-packagejson-with-config'
]

describe('repair command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(() => {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, (dir, absoluteDir) => {
      switch (dir) {
        case 'repair-packagejson-only':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'packagejson-only',
              dependencies: {
                jsreport: jsreportVersionToTest
              }
            }, null, 2)
          )
          return

        case 'repair-packagejson-with-server':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'packagejson-with-server',
              dependencies: {
                jsreport: jsreportVersionToTest
              }
            }, null, 2)
          )

          fs.writeFileSync(
            path.join(absoluteDir, './server.js'),
            'require("jsreport")().init()'
          )
          return

        case 'repair-packagejson-with-config':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'config',
              dependencies: {
                jsreport: jsreportVersionToTest
              }
            }, null, 2)
          )

          fs.writeFileSync(
            path.join(absoluteDir, './jsreport.config.json'),
            '{"store": { "provider": "fs" }}'
          )
      }
    })
  })

  it('should work on empty directory', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-empty')

    const jsreportPackage = await repair({ context: { cwd: dir } })

    // should install jsreport package
    should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
    // and generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)
  })

  it('should work with specific jsreport version', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-with-specific-version')
    const versionToInstall = jsreportVersionToTest

    const jsreportPackage = await repair({ context: { cwd: dir }, _: [null, versionToInstall] })

    // should install jsreport package
    should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
    // and generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)

    should(JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json')).toString()
    ).dependencies.jsreport).not.be.undefined()
  })

  it('should work on a directory that contains only package.json', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-only')

    await repair({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    // and replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('jsreport-server')
  })

  it('should override server.js file', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-with-server')

    await repair({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    // replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('jsreport-server')
    // and replace server.js
    should(
      fs.readFileSync(path.join(dir, 'server.js')).toString().trim()
    ).be.not.eql('require("jsreport")().init()')
  })

  it('should override jsreport.config.json file', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-with-config')

    await repair({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    // replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('jsreport-server')
    // and replace jsreport.config.json
    should(
      fs.readFileSync(path.join(dir, 'jsreport.config.json')).toString().trim()
    ).be.not.eql('{"store": { "provider": "fs" }}')
  })

  after(() => utils.cleanTempDir(TEMP_DIRS))
})
