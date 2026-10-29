#!/usr/bin/env node
import { run } from './run.mjs';

// Piping into `head` closes stdout early; that is not a failure of the generator.
process.stdout.on('error', (error) => {
  if (error.code !== 'EPIPE') throw error;
});

process.exitCode = await run(process.argv.slice(2));
