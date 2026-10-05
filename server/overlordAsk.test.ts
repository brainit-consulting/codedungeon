// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { ASK_RULE, overlordAsk } from './overlordAsk.ts';

describe('overlordAsk', () => {
  it('finds what they need at the end of their last message', () => {
    expect(overlordAsk('The limiter is written.\n\nOverlord: I need the Redis URL for REDIS_URL.')).toBe('I need the Redis URL for REDIS_URL.');
  });

  it('reads it however it is dressed up: bold, a list item, a quote, any case', () => {
    expect(overlordAsk('Done so far.\n**Overlord:** which payment provider?')).toBe('which payment provider?');
    expect(overlordAsk('- **Overlord**: an API key for OpenWeather')).toBe('an API key for OpenWeather');
    expect(overlordAsk('> overlord: access to the staging database')).toBe('access to the staging database');
  });

  it('keeps every line of a longer request', () => {
    expect(overlordAsk('Stuck.\nOverlord: two things:\n1. the Stripe test key\n2. the webhook secret')).toBe('two things:\n1. the Stripe test key\n2. the webhook secret');
  });

  it("isn't fooled by the word in passing, an empty line, or an old line far up a long message", () => {
    expect(overlordAsk('As the Overlord: asked, I kept the API the same.')).toBeNull();
    expect(overlordAsk('All done.\nOverlord:')).toBeNull();
    expect(overlordAsk(['Overlord: an old question', ...Array.from({ length: 30 }, (_, i) => `step ${i}`)].join('\n'))).toBeNull();
    expect(overlordAsk('Opened https://github.com/o/r/pull/4. It closes #3.')).toBeNull();
  });

  it('keeps it to a length the scroll can show', () => {
    expect(overlordAsk(`Overlord: ${'x'.repeat(2000)}`)!.length).toBeLessThanOrEqual(600);
  });

  it('is asked for in one sentence, which names the marker', () => {
    expect(ASK_RULE).toContain('"Overlord:"');
    expect(ASK_RULE.split('. ').length).toBeLessThanOrEqual(2);
  });
});
