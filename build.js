const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Function to recursively find all TypeScript files in a directory
function findTSFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findTSFiles(fullPath, files);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Function to get the relative path from src directory
function getRelativePath(filePath) {
  return path.relative('src', filePath).replace(/\\/g, '/');
}

// Function to get the output path in dist directory
function getOutputPath(filePath) {
  const relativePath = getRelativePath(filePath);
  const parsed = path.parse(relativePath);
  return path.join('dist', parsed.dir, 'index.js').replace(/\\/g, '/');
}

async function buildLambdas() {
  console.log('🚀 Building Lambda functions with esbuild...');

  // Find all TypeScript files in src/functions directory
  const tsFiles = findTSFiles('src/functions');

  if (tsFiles.length === 0) {
    console.log('❌ No TypeScript files found in src/functions directory');
    return;
  }

  console.log(`📁 Found ${tsFiles.length} TypeScript files:`);
  tsFiles.forEach((file) => console.log(`   - ${getRelativePath(file)}`));

  // Clean dist directory
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // Build each file
  const buildPromises = tsFiles.map(async (file) => {
    const outputPath = getOutputPath(file);
    const outputDir = path.dirname(outputPath);

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      await esbuild.build({
        entryPoints: [file],
        bundle: true,
        outfile: outputPath,
        platform: 'node',
        target: 'node20',
        format: 'cjs',
        sourcemap: false,
        minify: false,
        external: ['aws-sdk', '@aws-sdk/*'],
        alias: {
          '@': path.resolve('src'),
        },
        resolveExtensions: ['.ts', '.js'],
        loader: {
          '.ts': 'ts',
        },
        tsconfig: 'tsconfig.json',
      });

      console.log(`✅ Built: ${getRelativePath(file)} → ${outputPath}`);
    } catch (error) {
      console.error(`❌ Failed to build ${getRelativePath(file)}:`, error);
      throw error;
    }
  });

  try {
    await Promise.all(buildPromises);
    console.log(`🎉 Successfully built ${tsFiles.length} Lambda functions!`);
  } catch (error) {
    console.error('💥 Build failed:', error);
    process.exit(1);
  }
}

// Run the build
buildLambdas().catch(console.error);
