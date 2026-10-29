#!/usr/bin/env node
import { run } from './run.mjs';

process.exitCode = await run(process.argv.slice(2));
