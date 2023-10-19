const io = require('@actions/io')
const path = require('path')

let temDirCreated = false

async function tempDir() {
  const tmp = path.join(process.env.RUNNER_TEMP, 'podman-in-podman-build')

  if (!temDirCreated) {
    await io.mkdirP(tmp)
    temDirCreated = true
  }

  return tmp
}

module.exports = { tempDir }
