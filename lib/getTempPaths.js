const path = require('path')
const os = require('os')

module.exports = () => {
  const useCustomTempDirectory = process.env.cli_tempDirectory != null
  const useCustomSocketDirectory = process.env.cli_socketsDirectory != null
  const ROOT_PATH = !useCustomTempDirectory ? path.join(os.tmpdir(), 'jsreport') : process.env.cli_tempDirectory
  const CLI_PATH = path.join(ROOT_PATH, 'cli')
  const MAIN_SOCK_PATH = !useCustomSocketDirectory ? path.join(CLI_PATH, 'sock') : process.env.cli_socketsDirectory
  const WORKER_SOCK_PATH = path.join(MAIN_SOCK_PATH, 'workerSock')

  return {
    useCustomSocketDirectory,
    rootPath: ROOT_PATH,
    cliPath: CLI_PATH,
    mainSockPath: MAIN_SOCK_PATH,
    workerSockPath: WORKER_SOCK_PATH
  }
}
