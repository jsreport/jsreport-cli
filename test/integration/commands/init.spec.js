const path = require('path')
const fs = require('fs')
const should = require('should')
const jsreportVersionToTest = require('../../jsreportVersionToTest')
const utils = require('../../utils')
const init = require('../../../lib/commands/init').handler

const TEMP_DIRS = [
  'init-empty',
  'init-with-specific-version',
  'init-packagejson-only',
  'init-packagejson-with-server',
  'init-packagejson-with-config'
]

describe('init command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(() => {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, (dir, absoluteDir) => {
      switch (dir) {
        case 'init-packagejson-only':
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

        case 'init-packagejson-with-server':
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

        case 'init-packagejson-with-config':
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

  it('should initialize an empty directory', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('init-empty')

    const jsreportPackage = await init({ context: { cwd: dir } })

    // should install jsreport package
    should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
    // and generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)
  })

  it('should initialize with a specific jsreport version', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('init-with-specific-version')
    const versionToInstall = '1.3.0'

    const jsreportPackage = await init({ context: { cwd: dir }, _: [null, versionToInstall] })

    // should install jsreport package
    should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
    // and generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)

    should(JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json')).toString()
    ).dependencies.jsreport).endWith(versionToInstall)
  })

  it('should initialize a directory that contains only package.json', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('init-packagejson-only')

    await init({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    // but not replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('packagejson-only')
  })

  it('should not override server.js file', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('init-packagejson-with-server')

    await init({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    // but not replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('packagejson-with-server')
    // and not replace server.js
    should(
      fs.readFileSync(path.join(dir, 'server.js')).toString().trim()
    ).be.eql('require("jsreport")().init()')
  })

  it('should not override jsreport.config.json file', async function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('init-packagejson-with-config')

    await init({ context: { cwd: dir } })

    // should generate default files
    should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
    should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
    // but not replace package.json in dir
    should(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json')).toString()
      ).name
    ).be.eql('config')
    // and not replace jsreport.config.json
    should(
      fs.readFileSync(path.join(dir, 'jsreport.config.json')).toString().trim()
    ).be.eql('{"store": { "provider": "fs" }}')
  })

  after(() => utils.cleanTempDir(TEMP_DIRS))
})
