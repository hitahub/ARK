export const conventionalCommitPattern: RegExp;
export function findInvalidMessages(messages: string[]): string[];
export function findInvalidCommitSubjects(messages: string[]): string[];
export function getCommitSubjects(
  baseSha: string,
  headSha: string,
  defaultBranch?: string,
  cwd?: string,
): string[];
