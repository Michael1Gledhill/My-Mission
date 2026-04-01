import { defineConfig, loadEnv } from 'vite';
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    var repoName = (_b = env.GITHUB_REPOSITORY) === null || _b === void 0 ? void 0 : _b.split('/')[1];
    var isGithubActions = env.GITHUB_ACTIONS === 'true';
    return {
        base: isGithubActions && repoName ? "/".concat(repoName, "/") : '/',
        build: {
            outDir: 'dist',
            sourcemap: true
        }
    };
});
