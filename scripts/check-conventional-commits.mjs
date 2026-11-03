import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const conventionalCommitPattern =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test){1}(\([\w\-.]+\))?(!)?: ([\w ])+([\s\S]*)/;

export function findInvalidMessages(messages) {
  return messages.filter((message) => !conventionalCommitPattern.test(message));
}

function main() {
  const [baseSha, headSha] = process.argv.slice(2);
  if (!baseSha || !headSha) {
    console.error('Usage: node scripts/check-conventional-commits.mjs <base-sha> <head-sha>');
    process.exitCode = 1;
    return;
  }

  const range = /^0+$/.test(baseSha) ? headSha : `${baseSha}..${headSha}`;
  const commitSubjects = execFileSync('git', ['log', '--format=%s', range], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const messages = [...commitSubjects];
  if (process.env.PR_TITLE) messages.push(process.env.PR_TITLE);

  const invalid = findInvalidMessages(messages);
  if (invalid.length > 0) {
    console.error(
      'Commit subjects and PR titles must match the repository Conventional Commits ruleset:',
    );
    for (const message of invalid) console.error(`- ${message}`);
    process.exitCode = 1;
    return;
  }
  const pullRequestTitle = process.env.PR_TITLE ? ' and the pull request title' : '';
  console.log(`Validated ${commitSubjects.length} commit subject(s)${pullRequestTitle}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
