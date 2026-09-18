#!/usr/bin/env node
import { collect } from './collect.mjs'
import { configErrors } from './config.mjs'

/** `npm run collect` — one collection run, printed. */

const problems = configErrors()
if (problems.length > 0) {
  console.error(`Not configured: ${problems.join('; ')}`)
  console.error('See docs/data-sources.md, then authorise once via `npm run server` and /auth/google.')
  process.exit(1)
}

try {
  const { report, snapshotReady } = await collect()
  console.log(`window ${report.startDate} → ${report.endDate}`)
  console.log(`channels configured: ${report.channels}`)
  console.log(`collected: ${report.collected.length ? report.collected.join(', ') : 'none'}`)
  for (const warning of report.warnings) console.log(`  note: ${warning}`)
  for (const failure of report.failed) console.error(`  failed ${failure.channelId}: ${failure.error}`)
  if (!snapshotReady) {
    console.error('\nNothing was collected, so the snapshot still reads zero for YouTube.')
    process.exit(1)
  }
  console.log('\nSnapshot updated. Reload the console.')
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error))
  process.exit(1)
}
