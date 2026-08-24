import type { DesignSheet } from '../types';

export const caching: DesignSheet = {
  slug: 'caching',
  title: 'Caching',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  sourceUrl: 'https://www.hellointerview.com/learn/system-design/core-concepts/caching',
  tags: ['system-design', 'caching', 'redis', 'cdn', 'consistency'],
  updated: '2026-08-24',

  gist: [
    'Do NOT open with "I\'d add a cache." Identify the bottleneck, quantify it with rough numbers, THEN introduce caching as the fix. Caching proposed before a problem is named reads as a reflex, not a decision.',
    'If you remember one pattern, remember CACHE-ASIDE. The lesson says so explicitly, and it is the right default in almost every interview.',
    'The closing instruction is "don\'t cache everything" — show you know when the complexity is worth it and when a well-indexed database is already enough.',
  ],

  numbers: [
    { label: 'Postgres read', value: '~50 ms' },
    { label: 'Redis read', value: '~1 ms' },
    { label: 'Speedup', value: '~50×' },
    { label: 'Cross-continent RTT', value: '250–300 ms' },
    { label: 'CDN edge', value: '20–40 ms' },
    { label: 'Default eviction', value: 'LRU' },
  ],

  sections: [
    {
      heading: 'The five-step script — say it in this order',
      tone: 'good',
      points: [
        '1. NAME THE BOTTLENECK with a number. "User profile queries hit the database 500 times a second at 30 ms each." Vague slowness is not a justification.',
        '2. DECIDE WHAT TO CACHE. The qualifying shape: frequently read, infrequently changed, expensive to fetch. "Profiles are read on every page load and updated rarely."',
        '3. PICK THE ARCHITECTURE. Cache-aside by default. Add CDN for static media, in-process for a few hot keys.',
        '4. SET THE EVICTION POLICY and justify the TTL out loud. "10-minute TTL keeps the cache bounded and caps staleness."',
        '5. ADDRESS THE DOWNSIDE — invalidation, what happens when Redis dies, stampede prevention. Volunteering one of these is the senior signal.',
        'Triggers that establish the need: read-heavy ratios (10M users, 200M reads), expensive queries (200 ms join vs 1 ms cached), database CPU at 80% during peaks, or a sub-10 ms latency requirement.',
      ],
    },
    {
      heading: 'Where caches sit — four layers, pick deliberately',
      points: [
        'EXTERNAL (Redis / Memcached) — a standalone service between app and database. Shared across all app servers, supports TTL and eviction. This is what "a cache" means in an interview unless you say otherwise.',
        'CDN — edge servers near the user. Virginia to India is 250–300 ms; the same asset from an edge node is 20–40 ms. Modern CDNs cache static files, API responses, and even HTML.',
        'CLIENT-SIDE — browser HTTP cache, localStorage, mobile app storage. Nearly free, but you control neither the contents nor the invalidation. Never put anything you must be able to revoke here.',
        'IN-PROCESS — memory inside the app process. Fastest possible and no network hop, but not shared, so each server has its own copy and its own staleness. Right for config, feature flags, and a handful of extremely hot keys.',
        'These compose. A realistic answer is CDN for media + Redis for the read path + in-process for the top few keys, with a sentence on why each layer exists.',
      ],
    },
    {
      heading: 'Read and write patterns',
      points: [
        'CACHE-ASIDE (lazy loading) — the default. App checks cache; on a miss it reads the database, populates the cache, and returns. Only ever caches what someone actually asked for, so the cache stays lean. Cost: every miss pays both hops.',
        'READ-THROUGH — the cache itself fetches from the database on a miss; the app never talks to the database directly. Cleaner in principle, needs library support, and is what CDNs do. Less common in application code.',
        'WRITE-THROUGH — write to the cache, which synchronously writes to the database before acknowledging. Cache and database stay in step. Cost: every write pays both.',
        'WRITE-BEHIND (write-back) — write to the cache, which batches to the database asynchronously. Very fast writes, real risk of data loss if the cache dies before flushing. Acceptable for metrics and analytics, not for anything you cannot lose.',
        'THE TRAP: write-through does NOT solve the dual-write problem. If the cache write succeeds and the database write fails — or the reverse — the two are inconsistent. Saying this unprompted shows you have thought past the diagram.',
      ],
    },
    {
      heading: 'Eviction policies',
      points: [
        'LRU (least recently used) — the safe default. Evicts what has gone untouched longest; constant-time with a linked list or ring buffer. Right whenever recent access predicts future access.',
        'LFU (least frequently used) — evicts by access count. Better when a stable set stays popular: trending videos, top playlists. Cost: per-key counters, and it can hold on to formerly-popular items too long.',
        'FIFO — evicts by insertion order, ignoring usage entirely. The lesson\'s verdict: it may evict items that are still hot, so it is rarely used in real systems.',
        'TTL is NOT an eviction policy — it is per-key expiry that you combine WITH LRU or LFU. Worth stating precisely, because conflating them is a common slip.',
        'In an interview: "LRU with a 10-minute TTL" plus one sentence of justification is a complete answer.',
      ],
    },
    {
      heading: 'Failure modes — pick one or two, do not recite all of them',
      tone: 'warn',
      points: [
        'THUNDERING HERD / STAMPEDE — a popular key expires and thousands of requests rebuild it simultaneously, flattening the database. Fix: REQUEST COALESCING (single flight) so exactly one request rebuilds while the rest wait. The lesson names this the most effective option.',
        'Cache warming — proactively refresh hot keys before expiry — also works, but ONLY with TTL-based expiration. It does nothing when entries are removed by write invalidation. That caveat is a nice detail to land.',
        'HOT KEYS — one entry taking wildly disproportionate traffic can saturate a single node or shard even at a great hit rate. Fixes: replicate the key across nodes and load-balance, add an in-process fallback for the very hottest values, rate-limit abusive callers.',
        'CACHE FAILURE — say what happens when Redis is down. Circuit breaker, fall back to the database, or an in-process cache as a lifeboat. A design where a cache outage takes production down is not finished.',
        'The explicit warning: do NOT list every possible problem. Pick the one or two that actually matter for the system in front of you. A recital reads as memorised.',
      ],
    },
    {
      heading: 'Consistency — how stale, and for how long',
      points: [
        'The core problem: the database has moved on and the cache has not. Every strategy is a choice about how big that window is.',
        'INVALIDATE ON WRITE — delete the key after the database update, so the next read repopulates. Tightest window; costs a write-path dependency on the cache.',
        'SHORT TTL — accept bounded staleness. Simplest, and often correct.',
        'EVENTUAL CONSISTENCY — fine for feeds, metrics, and analytics, where a short delay is invisible to the user.',
        'There is no perfect answer, and the interviewer knows it. What is graded is whether you PICK one and name the freshness requirement it serves.',
        'Best move: split by data type. Strong freshness on the thing that would embarrass you if stale (balance, inventory), eventual on the rest (view counts, feeds).',
      ],
    },
    {
      heading: 'How candidates lose points here',
      tone: 'warn',
      points: [
        'Proposing a cache before naming a bottleneck. The most common version of this mistake.',
        'Caching everything. The lesson closes on this — sometimes a well-indexed database is simply enough, and saying so is a strength.',
        'Reciting all five failure modes to look thorough. Pick the relevant ones.',
        'Calling TTL an eviction policy.',
        'Claiming write-through guarantees consistency — the dual-write problem is still there.',
        'Never saying what happens when the cache goes down.',
        'Staff-level specifically: burning time on things the interviewer already assumes, instead of the non-obvious scenarios.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'Cache-aside vs read-through',
      a: 'Cache-aside — app orchestrates; only requested data is cached; works with any cache; a miss costs two hops.',
      b: 'Read-through — the cache fetches on miss; app code is simpler; needs library or platform support.',
      pick: 'Cache-aside, and say the name. It is the lesson\'s single recommended pattern and the one interviewers expect. Read-through is worth naming as what CDNs do.',
    },
    {
      axis: 'Write-through vs write-behind',
      a: 'Write-through — synchronous to the database; cache and store agree; writes are slower.',
      b: 'Write-behind — batched asynchronously; very fast; data loss if the cache dies before flushing.',
      pick: 'Write-through when the data matters, write-behind only for metrics and analytics where loss is tolerable. And note that write-through still has the dual-write problem — it reduces divergence, it does not eliminate it.',
    },
    {
      axis: 'Invalidate on write vs short TTL',
      a: 'Invalidate on write — freshest; couples the write path to the cache; misses cause a rebuild that can stampede.',
      b: 'Short TTL — dead simple, self-healing, bounded staleness; always some stale window.',
      pick: 'TTL by default, invalidation on top for data where staleness is visible to the user. Then name the stale window in seconds — an unquantified "eventually consistent" is not an answer.',
    },
    {
      axis: 'Cache vs fix the query',
      a: 'Add a cache — big latency win, new component, new failure mode, new consistency problem.',
      b: 'Add the right index or denormalise the read path — no new infrastructure, no staleness.',
      pick: 'Check the index first. "A well-indexed database is enough here" is a legitimate and well-regarded answer; reaching for Redis to solve a missing composite index is not.',
    },
  ],

  quickfire: [
    { q: 'Which caching pattern?', a: '"Cache-aside." Check cache, miss → read database → populate → return.' },
    { q: 'When do you introduce a cache?', a: 'After naming a bottleneck with numbers: read:write ratio, query cost, database CPU, or a latency target.' },
    { q: 'What do you cache?', a: 'Frequently read, rarely changed, expensive to fetch. All three, or it is not worth it.' },
    { q: 'Eviction policy?', a: 'LRU with a TTL. LFU if a stable set stays hot. FIFO essentially never.' },
    { q: 'What happens when a hot key expires?', a: 'Thundering herd. Request coalescing so one rebuild serves everyone; cache warming as well if expiry is TTL-based.' },
    { q: 'What if Redis goes down?', a: 'Circuit breaker and fall back to the database, with an in-process cache as a lifeboat. Degraded, not down.' },
    { q: 'How do you keep the cache consistent?', a: 'Invalidate on write plus a TTL, and state the stale window. Split it by data type — strong where it shows, eventual elsewhere.' },
    { q: 'Does write-through guarantee consistency?', a: 'No. If one of the two writes fails you are still inconsistent — the dual-write problem.' },
    { q: 'Is TTL an eviction policy?', a: 'No. It is per-key expiry, used alongside LRU or LFU.' },
    { q: 'Why not cache everything?', a: 'Every cached thing is a staleness bug and an invalidation path you now own. Sometimes the index is the answer.' },
  ],
};
