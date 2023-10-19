/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { cleanup } = require('./cleanup')
const core = require('@actions/core')

if (!core.getState('isPost')) {
  run()
} else {
  cleanup()
}
