const path = require('path')
const fs = require('fs')
const should = require('should')
const { init, clean, cwd, exec } = require('./utils')

describe.only('cli', () => {
  before(init)
  beforeEach(clean)

  it('--version should return versoin', () => {
    exec('--version').should.match(/jsreport version/)
  })

  it('--help should return versoin', () => {
    exec('--help').should.match(/USAGE: jsreport/)
  })

  it('render should write to output file', () => {
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    exec('render --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    fs.readFileSync(path.join(cwd, 'out.html')).toString().should.be.eql('foo')
  })

  it('render failing instance should provide init error', () => {
    fs.writeFileSync(path.join(cwd, 'jsreport.config.json'), 'intention')
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    should(() => {
      exec('render --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    }).throw(/Error parsing your configuration file/)
  })

  it('render with keepAlive and failing instance should provide init error', () => {
    fs.writeFileSync(path.join(cwd, 'jsreport.config.json'), 'intention')
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    should(() => {
      exec('render --keepAlive --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    }).throw(/Error parsing your configuration file/)
  })
})
