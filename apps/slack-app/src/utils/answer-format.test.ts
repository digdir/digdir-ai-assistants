import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  citedIndexes,
  fitBlocks,
  linkCitations,
  looksNorwegian,
  sectionBlock,
  SLACK_MAX_SECTION_TEXT,
  sourceBlocks,
  sourceLinks,
} from './answer-format';

const sources = [
  { index: 2, title: 'Tilgang | selvbetjening', url: 'https://docs.digdir.no/a.html' },
  { index: 1, title: 'Uten lenke' },
  { index: 3, title: 'Tredje', url: 'https://docs.digdir.no/c.html' },
];

test('[N] resolves by source index, not by position', () => {
  assert.equal(
    linkCitations('Se [2] og [3].', sources),
    'Se [[2]](https://docs.digdir.no/a.html) og [[3]](https://docs.digdir.no/c.html).',
  );
});

test('[N] without a url, or without a source, stays as it is', () => {
  assert.equal(linkCitations('Se [1] og [9].', sources), 'Se [1] og [9].');
});

test('[2, 3] becomes one link per source', () => {
  assert.equal(
    linkCitations('Se [2, 3].', sources),
    'Se [[2]](https://docs.digdir.no/a.html)[[3]](https://docs.digdir.no/c.html).',
  );
});

test('code is left alone', () => {
  const text = 'Bruk `arr[2]` og\n```\nx = y[3]\n```\nSe [2].';
  assert.equal(
    linkCitations(text, sources),
    'Bruk `arr[2]` og\n```\nx = y[3]\n```\nSe [[2]](https://docs.digdir.no/a.html).',
  );
  assert.deepEqual(citedIndexes(text), [2]);
});

test('citedIndexes lists each source once, in order of first use', () => {
  assert.deepEqual(citedIndexes('[3] så [1, 3] og [2]'), [3, 1, 2]);
});

test('sourceLinks lists cited sources with a url, in citation order', () => {
  assert.deepEqual(sourceLinks('Se [3], [1] og [2].', sources), [
    { title: 'Tredje', url: 'https://docs.digdir.no/c.html' },
    { title: 'Tilgang | selvbetjening', url: 'https://docs.digdir.no/a.html' },
  ]);
});

test('sourceLinks falls back to the listed sources when nothing is cited', () => {
  const listed = [
    { title: 'A', url: 'https://x.no/a' },
    { title: 'A again', url: 'https://x.no/a' },
    { title: 'B', url: 'https://x.no/b' },
  ];
  assert.deepEqual(sourceLinks('No markers here.', listed), [
    { title: 'A', url: 'https://x.no/a' },
    { title: 'B', url: 'https://x.no/b' },
  ]);
});

test('sourceBlocks escapes link text and keeps each section within the limit', () => {
  const [block] = sourceBlocks(sourceLinks('[2]', sources), 'Les mer:');
  assert.equal(
    block.text.text,
    'Les mer:\n• <https://docs.digdir.no/a.html|Tilgang - selvbetjening>',
  );

  const many = Array.from({ length: 60 }, (_, i) => ({
    title: 'x'.repeat(80),
    url: `https://docs.digdir.no/${i}.html`,
  }));
  const blocks = sourceBlocks(many, 'Les mer:');
  assert.ok(blocks.length > 1);
  for (const b of blocks) assert.ok(b.text.text.length <= SLACK_MAX_SECTION_TEXT);
  assert.equal(
    blocks
      .map((b) => b.text.text)
      .join('\n')
      .split('\n•').length - 1,
    60,
  );
});

test('fitBlocks keeps the trailing blocks and stays within 50 blocks', () => {
  const answer = Array.from({ length: 60 }, (_, i) => sectionBlock(`p${i}`));
  const trailing = [sectionBlock('sources'), sectionBlock('footer')];
  const fitted = fitBlocks(answer, trailing);
  assert.equal(fitted.length, 50);
  assert.deepEqual(fitted.slice(-2), trailing);
  assert.equal(fitted[47].text.text, '…');
  assert.equal(fitBlocks([sectionBlock('a')], trailing).length, 3);
});

test('looksNorwegian', () => {
  assert.equal(looksNorwegian('Hvordan får jeg tilgang til Maskinporten?'), true);
  assert.equal(looksNorwegian('Hvordan kan jeg logge inn'), true);
  assert.equal(looksNorwegian('How do I get access to Maskinporten?'), false);
});
