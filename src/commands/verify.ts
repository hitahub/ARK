import fs from 'fs-extra';
import path from 'node:path';
import { files } from '../templates/index.js';

const requiredDirectories = [
  '000_Atlas',
  '100_Spaces',
  '100_Spaces/110_Career_Business',
  '100_Spaces/120_Creative_SideHustle',
  '100_Spaces/130_Personal',
  '200_Projects',
  '300_Slipbox',
  '400_Journal',
  '999_Templates',
];

const requiredFiles = [
  '000_Atlas/Dashboard.md',
  '000_Atlas/MoC_Idea_Matrix.md',
  '999_Templates/TPL_Concept.md',
  '999_Templates/TPL_Project_Task.md',
  '999_Templates/TPL_Daily_Journal.md',
  '999_Templates/TPL_Tech_Architecture.md',
  '999_Templates/TPL_Meeting_Note.md',
  '999_Templates/TPL_Weekly_Review.md',
  '.claudeignore',
];

export interface VerificationResult {
  valid: boolean;
  issues: string[];
}

export async function verifyVault(targetPath = process.cwd()): Promise<VerificationResult> {
  const target = path.resolve(targetPath);
  const issues: string[] = [];

  for (const relativePath of requiredDirectories) {
    const absolutePath = path.join(target, relativePath);
    if (!(await fs.pathExists(absolutePath)) || !(await fs.stat(absolutePath)).isDirectory()) {
      issues.push(`Missing required directory: ${relativePath}`);
    }
  }

  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(target, relativePath);
    if (!(await fs.pathExists(absolutePath)) || !(await fs.stat(absolutePath)).isFile()) {
      issues.push(`Missing required file: ${relativePath}`);
    }
  }

  const slipboxPath = path.join(target, '300_Slipbox');
  if (await fs.pathExists(slipboxPath)) {
    const entries = await fs.readdir(slipboxPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(slipboxPath, entry.name);
      // Directory symlinks also violate the flat-storage rule, even though Dirent marks them as links.
      if (
        entry.isDirectory() ||
        (entry.isSymbolicLink() && (await fs.stat(entryPath)).isDirectory())
      ) {
        issues.push(`Slipbox must remain flat; found directory: 300_Slipbox/${entry.name}`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function reportVerification(result: VerificationResult, targetPath: string): void {
  if (result.valid) {
    console.log(`ARC structure verified: ${path.resolve(targetPath)}`);
    return;
  }
  console.error(`ARC verification failed: ${path.resolve(targetPath)}`);
  for (const issue of result.issues) {
    console.error(`- ${issue}`);
  }
}

export const requiredScaffoldFiles = files;
