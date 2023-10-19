const io = require('@actions/io')
const core = require('@actions/core')
const { Podman } = require('./podman')
const { savePodmanImageCache } = require('./cache')

async function cleanup() {
  try {
    const podman = new Podman(await io.which('podman', true))
    const podmanImage = core.getInput('podman-image')
    await savePodmanImageCache(podman, podmanImage)

    const podmanContainer = podman.getContainer('podmaninpodman')
    await podmanContainer.remove(true)
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = { cleanup }
