import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Data compilation plugin
function compileGameData() {
  return {
    name: 'compile-game-data',
    buildStart() {
      console.log('\n🔨 Compiling game data...');
      try {
        execSync('node scripts/compileData.cjs', {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log('✅ Game data compiled successfully\n');
      } catch (error) {
        console.error('❌ Failed to compile game data:', error.message);
        throw error;
      }
    },
    configureServer(server) {
      // Watch source data files and recompile on change
      const watcher = server.watcher;
      watcher.add('data/source/**/*.json');

      watcher.on('change', (path) => {
        if (path.includes('data/source/')) {
          console.log('\n🔄 Source data changed, recompiling...');
          try {
            execSync('node scripts/compileData.cjs', {
              stdio: 'inherit',
              cwd: process.cwd()
            });
            console.log('✅ Data recompiled\n');
            // Trigger HMR for data files
            server.ws.send({
              type: 'full-reload',
              path: '*'
            });
          } catch (error) {
            console.error('❌ Failed to recompile data:', error.message);
          }
        }
      });
    }
  }
}

export default defineConfig({
  plugins: [
    compileGameData(),
    react()
  ],
  // Set base path for subdirectory deployment:
  // - Default '/' for root deployment
  // - Set to '/stardew/' for example.com/stardew/
  // - Or use env: base: process.env.BASE_URL || '/'
  base: './',
  server: {
    // Enable client-side routing in dev mode
    historyApiFallback: true,
  }
})
