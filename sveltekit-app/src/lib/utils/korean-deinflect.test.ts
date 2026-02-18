/**
 * Unit tests for Korean particle stripping and deinflection
 * Run with: npx tsx src/lib/utils/korean-deinflect.test.ts
 */

import { koreanDeinflect, formatKoreanReasons, KoreanReason, isHangulOnly } from './korean-deinflect';

// Simple test runner
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function assertIncludes(candidates: { word: string; reasons: KoreanReason[] }[], word: string, reason?: KoreanReason, message?: string) {
  const found = candidates.find(c => c.word === word && (reason === undefined || c.reasons.includes(reason)));
  const msg = message || `Should include "${word}"${reason !== undefined ? ` with reason ${KoreanReason[reason]}` : ''}`;
  assert(!!found, msg);
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  console.log(`  ${name}`);
  fn();
}

// ============= Tests =============

describe('isHangulOnly', () => {
  it('should return true for Korean text', () => {
    assert(isHangulOnly('나') === true, '나 is Hangul');
    assert(isHangulOnly('안녕하세요') === true, '안녕하세요 is Hangul');
    assert(isHangulOnly('내가') === true, '내가 is Hangul');
  });

  it('should return false for non-Korean text', () => {
    assert(isHangulOnly('hello') === false, 'hello is not Hangul');
    assert(isHangulOnly('食べる') === false, '食べる is not Hangul');
    assert(isHangulOnly('나hello') === false, 'mixed text is not Hangul-only');
  });
});

describe('Korean Particle Stripping - Subject Particles', () => {
  it('should handle 내가 → 나 (vowel contraction with subject particle)', () => {
    const results = koreanDeinflect('내가');
    assertIncludes(results, '나', KoreanReason.SubjectParticle);
  });

  it('should handle 제가 → 저 (vowel contraction with subject particle)', () => {
    const results = koreanDeinflect('제가');
    assertIncludes(results, '저', KoreanReason.SubjectParticle);
  });

  it('should handle 네가 → 너 (vowel contraction with subject particle)', () => {
    const results = koreanDeinflect('네가');
    assertIncludes(results, '너', KoreanReason.SubjectParticle);
  });

  it('should handle 누가 → 누구 (special contraction)', () => {
    const results = koreanDeinflect('누가');
    assertIncludes(results, '누구', KoreanReason.SubjectParticle);
  });

  it('should handle 사람이 → 사람 (subject particle after consonant)', () => {
    const results = koreanDeinflect('사람이');
    assertIncludes(results, '사람', KoreanReason.SubjectParticle);
  });
});

describe('Korean Particle Stripping - Topic Particles', () => {
  it('should handle 나는 → 나 (topic particle after vowel)', () => {
    const results = koreanDeinflect('나는');
    assertIncludes(results, '나', KoreanReason.TopicParticle);
  });

  it('should handle 물은 → 물 (topic particle after consonant)', () => {
    const results = koreanDeinflect('물은');
    assertIncludes(results, '물', KoreanReason.TopicParticle);
  });
});

describe('Korean Particle Stripping - Object Particles', () => {
  it('should handle 책을 → 책 (object particle after consonant)', () => {
    const results = koreanDeinflect('책을');
    assertIncludes(results, '책', KoreanReason.ObjectParticle);
  });

  it('should handle 나를 → 나 (object particle after vowel)', () => {
    const results = koreanDeinflect('나를');
    assertIncludes(results, '나', KoreanReason.ObjectParticle);
  });
});

describe('Korean Particle Stripping - Possessive Particle', () => {
  it('should handle 나의 → 나 (possessive particle)', () => {
    const results = koreanDeinflect('나의');
    assertIncludes(results, '나', KoreanReason.PossessiveParticle);
  });

  it('should handle 사람의 → 사람 (possessive particle)', () => {
    const results = koreanDeinflect('사람의');
    assertIncludes(results, '사람', KoreanReason.PossessiveParticle);
  });
});

describe('formatKoreanReasons', () => {
  it('should format subject particle reason', () => {
    const result = formatKoreanReasons([KoreanReason.SubjectParticle]);
    assert(result === 'subject', `Expected "subject", got "${result}"`);
  });

  it('should format topic particle reason', () => {
    const result = formatKoreanReasons([KoreanReason.TopicParticle]);
    assert(result === 'topic', `Expected "topic", got "${result}"`);
  });

  it('should format object particle reason', () => {
    const result = formatKoreanReasons([KoreanReason.ObjectParticle]);
    assert(result === 'object', `Expected "object", got "${result}"`);
  });

  it('should format possessive particle reason', () => {
    const result = formatKoreanReasons([KoreanReason.PossessiveParticle]);
    assert(result === 'possessive', `Expected "possessive", got "${result}"`);
  });
});

// ============= Run and Report =============
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}

