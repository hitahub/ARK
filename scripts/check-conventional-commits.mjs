import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const conventionalCommitPattern =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test){1}(\([\w\-.]+\))?(!)?: ([\w ])+([\s\S]*)/;

const generatedAgentHostCommitPattern = /^Agent Host changes for [\w][\w./-]*$/;

export function findInvalidMessages(messages) {
  return messages.filter((message) => !conventionalCommitPattern.test(message));
}

export function findInvalidCommitSubjects(messages) {
  return messages.filter(
    (message) =>
      !generatedAgentHostCommitPattern.test(message) && !conventionalCommitPattern.test(message),
  );
}

export function getCommitSubjects(
  baseSha,
  headSha,
  defaultBranch = process.env.DEFAULT_BRANCH,
  cwd = process.cwd(),
) {
  let base = baseSha;
  if (/^0+$/.test(base)) {
    if (!defaultBranch) {
      throw new Error('DEFAULT_BRANCH is required when the push event has no base commit.');
    }
    base = execFileSync('git', ['merge-base', headSha, `origin/${defaultBranch}`], {
      encoding: 'utf8',
      cwd,
    }).trim();
  }
  return execFileSync('git', ['log', '--no-merges', '--format=%s', `${base}..${headSha}`], {
    encoding: 'utf8',
    cwd,
  })
    .split('\n')
    .filter(Boolean);
}

function main() {
  const [baseSha, headSha] = process.argv.slice(2);
  if (!baseSha || !headSha) {
    console.error('Usage: node scripts/check-conventional-commits.mjs <base-sha> <head-sha>');
    process.exitCode = 1;
    return;
  }

  const commitSubjects = getCommitSubjects(baseSha, headSha);
  const invalid = findInvalidCommitSubjects(commitSubjects);
  if (process.env.PR_TITLE) invalid.push(...findInvalidMessages([process.env.PR_TITLE]));
  if (invalid.length > 0) {
    console.error(
      'Commit subjects and PR titles must match the repository Conventional Commits ruleset:',
    );
    for (const message of invalid) console.error(`- ${message}`);
    process.exitCode = 1;
    return;
  }
  const pullRequestTitle = process.env.PR_TITLE ? ' and the pull request title' : '';
  console.log(
    `Validated ${commitSubjects.length} commit subject(s)${pullRequestTitle}; merge commits and generated Agent Host subjects are excluded.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
