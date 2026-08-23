import type { DesignSheet } from '../types';

export const deliveryFramework: DesignSheet = {
  slug: 'delivery-framework',
  title: 'System Design Delivery Framework',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  tags: ['system-design', 'framework', 'process'],
  updated: '2026-08-22',

  gist: [
    'Six phases, in order, timeboxed. The structure is what gets scored — a strong design delivered as a ramble reads as a weak design.',
    'You drive. Narrate the phase you are entering ("let me nail down requirements first") so the interviewer knows where you are and can redirect cheaply.',
    'Breadth before depth, always. A complete shallow system then two deep dives beats half a system designed perfectly.',
  ],

  numbers: [
    { label: 'Requirements', value: '~5 min' },
    { label: 'Core entities', value: '~2 min' },
    { label: 'API / interface', value: '~5 min' },
    { label: 'High-level design', value: '~10–15 min' },
    { label: 'Deep dives', value: '~10 min' },
    { label: 'Typical total', value: '35–45 min' },
  ],

  sections: [
    {
      heading: '1 · Requirements (~5 min)',
      points: [
        'Functional: 3–5 bullets max, as user-facing verbs. "Users can post a tweet." Not "the system stores tweets."',
        'Ask which to prioritise if the product is broad — narrowing scope is a senior signal, not a dodge.',
        'Non-functional: quantify or it does not count. Not "highly available" but "99.99%, reads can be a few seconds stale."',
        'The NFR list is where you plant the flags you will cash in later: consistency model, latency target, read:write ratio, scale.',
        'Explicitly say what is OUT of scope. It stops the interviewer wondering if you forgot it.',
      ],
    },
    {
      heading: '2 · Core entities (~2 min)',
      points: [
        'Just names, on the board: User, Tweet, Follow. No columns yet.',
        'Cheap insurance — it fixes your vocabulary before the API, so you do not rename things mid-design.',
        'Schema detail comes later, and only where a deep dive needs it.',
      ],
    },
    {
      heading: '3 · API / interface (~5 min)',
      points: [
        'One endpoint per functional requirement. If a requirement has no endpoint, you dropped it.',
        'REST by default. Say why if you pick something else: GraphQL for client-driven aggregation, gRPC for internal service-to-service, WebSocket/SSE for server push.',
        'Never take userId as a parameter — it comes from the auth token. Interviewers watch for this exact thing.',
        'Show pagination on any list endpoint. Cursor, not offset, and know the reason (offset drifts and gets slower deep in the list).',
      ],
    },
    {
      heading: '4 · High-level design (~10–15 min)',
      points: [
        'Draw boxes that satisfy the API, one endpoint at a time. Trace a request end to end out loud.',
        'Start boring: client → load balancer → service → database. Add components only when a requirement forces one.',
        'Every arrow gets a protocol and a direction. Unlabelled arrows are where interviews go quiet.',
        'Resist optimising here. If you catch yourself sharding in minute 12, you are out of order.',
      ],
    },
    {
      heading: '5 · Deep dives (~10 min)',
      tone: 'good',
      points: [
        'Revisit each non-functional requirement and show the design actually meets it. That is the deep-dive agenda, ready-made.',
        'Also fair game: the bottleneck you flagged earlier, a failure mode, or whatever the interviewer keeps circling back to.',
        'THIS is where back-of-the-envelope math belongs — to justify a decision, never as a ritual up front. "300 GB/day × 3 years = ~330 TB, so one Postgres box is out."',
        'Senior/staff bar: you are expected to spot the bottleneck yourself and open the dive unprompted. Waiting to be asked reads as mid-level.',
      ],
    },
    {
      heading: 'Failure modes that sink otherwise-good candidates',
      tone: 'warn',
      points: [
        'Jumping to the whiteboard before requirements are agreed. Everything after is unanchored.',
        'Reciting a memorised architecture that does not follow from the stated requirements.',
        'Naming a technology with no reason attached. "I would use Kafka" — for what property? Durability? Replay? Ordering? Say the property, not the logo.',
        'Silence while thinking. Narrate, or the interviewer cannot give you the hint they are holding.',
        'Running out of time with no deep dive. Watch the clock; leave the last third free.',
        'Defending a choice after the interviewer pushes twice. They are usually handing you the answer.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'SQL vs NoSQL',
      a: 'SQL — transactions, joins, flexible query patterns, mature ops.',
      b: 'NoSQL — horizontal scale, known access patterns, flat schema.',
      pick: 'Default to Postgres and justify moving off it. It scales further than candidates think, and "I would start with Postgres because the access pattern is relational, and shard by X when we cross Y" is a stronger answer than reaching for Cassandra in minute three.',
    },
    {
      axis: 'Strong vs eventual consistency',
      a: 'Strong — money, inventory, booking, anything double-spendable.',
      b: 'Eventual — feeds, counters, likes, analytics, search indexes.',
      pick: 'Pick per-feature, not per-system. The best answer usually splits: strong for the booking write, eventual for the "seats remaining" display.',
    },
    {
      axis: 'Sync vs async processing',
      a: 'Sync — the user needs the result to continue.',
      b: 'Async via queue — slow, retryable, or spiky work.',
      pick: 'Async anything the user does not have to wait for. Then say what happens on failure — retry policy, DLQ, idempotency key — because that follow-up is coming.',
    },
    {
      axis: 'Push vs pull (fanout)',
      a: 'Fanout-on-write — precompute per-user feeds. Fast reads, expensive writes.',
      b: 'Fanout-on-read — assemble at request time. Cheap writes, slow reads.',
      pick: 'Hybrid, and be ready to say why: push for normal users, pull for celebrity accounts whose fanout would be millions of writes. Naming the celebrity problem unprompted is a strong signal.',
    },
  ],

  quickfire: [
    { q: 'How do you scale reads?', a: 'Cache first (measure the hit rate), then read replicas, then denormalise the read path. In that order — each is cheaper than the next.' },
    { q: 'How do you scale writes?', a: 'Batch, then partition/shard on a key with even distribution and no cross-shard transactions. Say what your shard key is and what query it breaks.' },
    { q: 'What is your shard key?', a: 'Something high-cardinality that matches your dominant query. Then name the hotspot it creates and how you would detect one.' },
    { q: 'How do you keep the cache consistent?', a: 'Cache-aside with a TTL, invalidate on write. Accept a stale window and say how long it is. Mention thundering herd and the fix (jittered TTLs, single-flight).' },
    { q: 'How do you handle duplicate requests?', a: 'Idempotency key from the client, stored server-side with the result. Same key returns the same response instead of re-executing.' },
    { q: 'How do you rate limit?', a: 'Token bucket in Redis, keyed by user or IP. Sliding window if burst behaviour matters. Say where it sits — gateway, not the service.' },
    { q: 'What breaks first at 10×?', a: 'Have an answer ready before being asked. Usually the database write path or a single-threaded coordinator. Naming it unprompted is the whole senior signal.' },
  ],
};
