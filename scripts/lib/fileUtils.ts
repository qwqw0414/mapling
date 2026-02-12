// ============================================================================
// Shared File Utility Functions for Fetch Scripts
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Filename Generation
// ============================================================================

/**
 * ID와 이름으로 안전한 파일명을 생성한다.
 * 영문/숫자만 허용하고 나머지는 하이픈으로 치환한다.
 *
 * @param id - 엔티티 ID (맵, 몹, 아이템)
 * @param name - 영문 이름
 * @returns `{id}_{safe-name}.json` 형식의 파일명
 */
export function generateFilename(id: number, name: string): string {
  const safeName = (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${id}_${safeName || 'unknown'}.json`;
}

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * 디렉토리가 없으면 재귀적으로 생성한다.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// JSON Save
// ============================================================================

/**
 * JSON 데이터를 파일로 저장한다.
 * 기존 파일이 있으면 한글 이름을 보존한다.
 *
 * @param outputPath - 저장 경로
 * @param data - JSON으로 직렬화할 데이터
 * @param preserveNameField - 기존 파일의 name 필드를 보존할지 여부
 */
export function saveJson(
  outputPath: string,
  data: Record<string, unknown>,
  preserveNameField: boolean = false,
): void {
  // 기존 파일이 있으면 한글 이름 유지
  if (preserveNameField && fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (existing.name && existing.name !== data.nameEn) {
        data.name = existing.name;
      }
    } catch {
      // 기존 파일 파싱 실패 시 무시
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ============================================================================
// File Existence Check
// ============================================================================

/**
 * 지정된 디렉토리에서 ID prefix로 시작하는 JSON 파일이 존재하는지 확인한다.
 *
 * @param dir - 검색할 디렉토리
 * @param id - 엔티티 ID
 * @returns 파일 존재 여부
 */
export function fileExists(dir: string, id: number): boolean {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir);
  return files.some((f) => f.startsWith(`${id}_`) && f.endsWith('.json'));
}

/**
 * 지정된 디렉토리에서 ID prefix로 시작하는 JSON 파일을 읽어 파싱한다.
 *
 * @param dir - 검색할 디렉토리
 * @param id - 엔티티 ID
 * @returns 파싱된 데이터 또는 null
 */
export function loadExistingJson<T>(dir: string, id: number): T | null {
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir);
  const targetFile = files.find((f) => f.startsWith(`${id}_`) && f.endsWith('.json'));

  if (targetFile) {
    try {
      const content = fs.readFileSync(path.join(dir, targetFile), 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
}
