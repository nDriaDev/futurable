#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifica Setup Futurable Test Suite\n');

const checks = [];

// Check Node version
const nodeVersion = process.version;
const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
checks.push({
  name: 'Node.js version >= 20',
  pass: nodeMajor >= 20,
  detail: `Versione attuale: ${nodeVersion}`
});

// Check package.json
const pkgPath = join(process.cwd(), 'package.json');
checks.push({
  name: 'package.json exists',
  pass: existsSync(pkgPath),
  detail: pkgPath
});

// Check src directory
const srcPath = join(process.cwd(), 'src');
checks.push({
  name: 'Directory src/ exists',
  pass: existsSync(srcPath),
  detail: srcPath
});

// Check Futurable.ts
const futurablePath = join(srcPath, 'Futurable.ts');
const futurableExists = existsSync(futurablePath);
const futurableSize = futurableExists ? statSync(futurablePath).size : 0;
checks.push({
  name: 'src/Futurable.ts exists and has content',
  pass: futurableExists && futurableSize > 1000,
  detail: futurableExists ? `${futurableSize} bytes` : 'File not found'
});

// Check FuturableTask.ts  
const taskPath = join(srcPath, 'FuturableTask.ts');
const taskExists = existsSync(taskPath);
const taskSize = taskExists ? statSync(taskPath).size : 0;
checks.push({
  name: 'src/FuturableTask.ts exists and has content',
  pass: taskExists && taskSize > 1000,
  detail: taskExists ? `${taskSize} bytes` : 'File not found'
});

// Check tests directory
const testsPath = join(process.cwd(), 'tests');
checks.push({
  name: 'Directory tests/ exists',
  pass: existsSync(testsPath),
  detail: testsPath
});

// Check test files
const testFiles = [
  'Futurable.test.ts',
  'FuturableTask.test.ts', 
  'FuturableTask.test2.ts'
];

testFiles.forEach(file => {
  const path = join(testsPath, file);
  checks.push({
    name: `tests/${file} exists`,
    pass: existsSync(path),
    detail: path
  });
});

// Check node_modules
const nmPath = join(process.cwd(), 'node_modules');
const nmExists = existsSync(nmPath);
checks.push({
  name: 'node_modules exists (npm install executed)',
  pass: nmExists,
  detail: nmExists ? 'OK' : 'Esegui: npm install'
});

// Check dependencies
if (nmExists) {
  const deps = ['tsx', 'typescript', '@types/node'];
  deps.forEach(dep => {
    const depPath = join(nmPath, dep);
    checks.push({
      name: `Dependency ${dep} installed`,
      pass: existsSync(depPath),
      detail: depPath
    });
  });
}

// Print results
console.log('Risultati:\n');
let allPass = true;
checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  if (!check.pass || process.argv.includes('--verbose')) {
    console.log(`   ${check.detail}`);
  }
  if (!check.pass) allPass = false;
});

console.log('\n' + '='.repeat(60) + '\n');

if (allPass) {
  console.log('🎉 Setup completo! Puoi eseguire i test con:');
  console.log('   npm test\n');
  console.log('Per coverage:');
  console.log('   npm run test:coverage\n');
} else {
  console.log('⚠️  Setup incompleto. Segui le istruzioni in SETUP.md\n');
  console.log('Passi mancanti:');
  checks.filter(c => !c.pass).forEach(c => {
    console.log(`   - ${c.name}`);
  });
  console.log('');
}

process.exit(allPass ? 0 : 1);
