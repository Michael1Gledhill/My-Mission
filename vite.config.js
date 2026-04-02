import { defineConfig, loadEnv } from 'vite';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    loadEnv(mode, '.', '');
    return {
        base: '/My-Mission/',
        build: {
            outDir: 'dist',
            sourcemap: true
        }
    };
});
