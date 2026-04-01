import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const repoName = env.GITHUB_REPOSITORY?.split('/')[1];
  const isGithubActions = env.GITHUB_ACTIONS === 'true';

  return {
    base: isGithubActions && repoName ? `/${repoName}/` : '/',
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});