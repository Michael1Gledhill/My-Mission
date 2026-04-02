interface GitHubConfig {
  user: string;
  repo: string;
  branch: string;
  token: string;
}

interface GitHubFile {
  sha: string;
  content: string;
  [key: string]: any;
}

export async function getGitHubConfig(): Promise<GitHubConfig | null> {
  try {
    const stored = localStorage.getItem('mission_gh');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export async function saveGitHubConfig(config: GitHubConfig): Promise<void> {
  localStorage.setItem('mission_gh', JSON.stringify(config));
}

export async function testGitHubConnection(config: GitHubConfig): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.user}/${config.repo}`,
      {
        headers: {
          'Authorization': `token ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function getFileSha(
  config: GitHubConfig,
  filename: string
): Promise<string | undefined> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.user}/${config.repo}/contents/${filename}?ref=${config.branch}`,
      {
        headers: {
          'Authorization': `token ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    if (response.ok) {
      const data = (await response.json()) as GitHubFile;
      return data.sha;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function pushDataToGitHub(
  config: GitHubConfig,
  data: any,
  message: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; sha?: string; error?: string }> {
  try {
    const log = (msg: string) => {
      console.log(msg);
      onProgress?.(msg);
    };

    log('🔍 Fetching current file SHA...');
    const sha = await getFileSha(config, 'data.json');

    log('📦 Encoding content...');
    const toCommit = { ...data };
    delete (toCommit as any)._ts;

    const jsonString = JSON.stringify(toCommit, null, 2);
    const content = btoa(unescape(encodeURIComponent(jsonString)));

    log('🚀 Pushing to GitHub...');
    const body: any = {
      message,
      content,
      branch: config.branch
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${config.user}/${config.repo}/contents/data.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${config.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const err = (await response.json()) as any;
      const errorMsg = err.message || 'Unknown error';
      log(`❌ Push failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const result = (await response.json()) as any;
    const commitSha = result.commit?.sha || 'unknown';
    log(`✅ Success! Commit: ${commitSha}`);
    log('🎉 Your data is now on GitHub!');

    return {
      success: true,
      sha: commitSha
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('GitHub push error:', err);
    onProgress?.(`❌ Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

export async function fetchDataFromGitHub(
  config: GitHubConfig
): Promise<any | null> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${config.user}/${config.repo}/${config.branch}/data.json?t=${Date.now()}`,
      {
        signal: AbortSignal.timeout(5000)
      }
    );

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}
