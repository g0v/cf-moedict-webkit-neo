import { describe, expect, it } from 'vitest';
import { dedupeHeteronyms } from '../../src/utils/heteronym-dedup';

describe('dedupeHeteronyms', () => {
  it('removes near-duplicate heteronyms that only differ by whitespace in bopomofo', () => {
    const input = [
      {
        audio_id: '284300045',
        bopomofo: 'ㄏㄨㄚ ㄓ ㄓㄠ ㄓㄢˇ',
        pinyin: 'huā zhī zhāo zhǎn',
        definitions: [{ def: '形容花木枝葉迎風搖擺。' }, { def: '比喻人打扮豔麗。' }],
      },
      {
        audio_id: '284300045',
        bopomofo: 'ㄏㄨㄚ　ㄓ　ㄓㄠ　ㄓㄢˇ',
        pinyin: 'huā zhī zhāo zhǎn',
        definitions: [
          { def: '形容花木枝葉迎風搖擺。' },
          { def: '比喻女子打扮豔麗。也作「花枝招颭」。' },
        ],
      },
    ];

    const result = dedupeHeteronyms(input);

    expect(result).toHaveLength(1);
    expect(result[0]!.definitions).toEqual([
      { def: '形容花木枝葉迎風搖擺。' },
      { def: '比喻女子打扮豔麗。也作「花枝招颭」。' },
    ]);
  });

  it('removes byte-identical duplicate heteronyms', () => {
    const reading = {
      audio_id: '6025',
      bopomofo: 'ㄧㄠˋ',
      pinyin: 'yào',
      definitions: [{ def: '光輝、光彩。' }],
    };
    expect(dedupeHeteronyms([reading, { ...reading }])).toHaveLength(1);
  });

  it('keeps legitimate heteronyms that share audio_id but differ in bopomofo (輕聲 variants)', () => {
    const input = [
      { audio_id: '179200072', bopomofo: 'ㄌㄠˇ ˙ㄍㄨㄥ', pinyin: 'lǎo gong' },
      { audio_id: '179200072', bopomofo: 'ㄌㄠˇ ㄍㄨㄥ', pinyin: 'lǎo gōng' },
    ];
    expect(dedupeHeteronyms(input)).toHaveLength(2);
  });

  it('keeps legitimate heteronyms with distinct pronunciations', () => {
    const input = [
      { audio_id: '6025', bopomofo: 'ㄧㄠˋ', pinyin: 'yào' },
      { bopomofo: 'ㄩㄝˋ', pinyin: 'yuè' },
    ];
    expect(dedupeHeteronyms(input)).toHaveLength(2);
  });

  it('dedupes by bopomofo+pinyin when audio_id is absent', () => {
    const input = [
      { bopomofo: 'ㄩㄝˋ', pinyin: 'yuè', definitions: [{ def: '之又音。' }] },
      { bopomofo: 'ㄩㄝˋ', pinyin: 'yuè', definitions: [{ def: '之又音。' }] },
    ];
    expect(dedupeHeteronyms(input)).toHaveLength(1);
  });

  it('leaves untouched heteronyms that have no identity fields at all', () => {
    const input = [
      { definitions: [{ def: 'A' }] },
      { definitions: [{ def: 'B' }] },
    ];
    expect(dedupeHeteronyms(input)).toHaveLength(2);
  });

  it('preserves order of unique heteronyms', () => {
    const input = [
      { audio_id: '1', bopomofo: 'ㄐㄧㄚ', pinyin: 'jiā' },
      { audio_id: '2', bopomofo: 'ㄧˇ', pinyin: 'yǐ' },
      { audio_id: '1', bopomofo: 'ㄐㄧㄚ', pinyin: 'jiā' },
      { audio_id: '3', bopomofo: 'ㄅㄧㄥˇ', pinyin: 'bǐng' },
    ];
    const result = dedupeHeteronyms(input);
    expect(result.map((h) => h.audio_id)).toEqual(['1', '2', '3']);
  });
});
