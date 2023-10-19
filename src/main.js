const core = require('@actions/core')
const io = require('@actions/io')
const { Podman, createPodmanInPodman } = require('./podman')
const { loadPodmanImageCache } = require('./cache')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const podman = new Podman(await io.which('podman', true))
    const podmanImage = core.getInput('podman-image')
    await loadPodmanImageCache(podman, podmanImage)

    const containerfile = core.getInput('containerfile')
    const platforms = core.getMultilineInput('platforms')
    const workdir = core.getInput('workdir')
    const repo = core.getInput('repository', { required: true })
    const tags = core.getMultilineInput('tags', { required: true })
    const buildArgs = core.getMultilineInput('build-args')
    const labels = core.getMultilineInput('labels')

    const pmipm = await createPodmanInPodman(
      podman,
      process.cwd(),
      workdir,
      podmanImage
    )

    await pmipm.build(
      containerfile,
      workdir,
      platforms,
      repo,
      tags,
      buildArgs,
      labels
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
