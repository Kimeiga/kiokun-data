import assert from 'node:assert/strict';
import { reelShardForWord } from './reel-shards';

assert.equal(reelShardForWord('銀行'), reelShardForWord('銀行'));
assert.equal(reelShardForWord('𠮟る').length, 2);
assert.match(reelShardForWord('延ばす'), /^[0-9a-f]{2}$/);

console.log('Reel shard tests passed.');
