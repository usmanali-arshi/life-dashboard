import type { DesignSheet } from '../types';

export const dataModeling: DesignSheet = {
  slug: 'data-modeling',
  title: 'Data Modeling',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  sourceUrl: 'https://www.hellointerview.com/learn/system-design/core-concepts/data-modeling',
  tags: ['system-design', 'databases', 'sql', 'sharding', 'indexing'],
  updated: '2026-08-22',

  gist: [
    'Postgres is the answer. Reaching for an exotic database to look sophisticated is the single most common mistake in this section — Facebook models the social graph on MySQL.',
    'Access patterns drive everything. Derive them from the endpoints you just designed: for each one, ask "what query does this need?" Then build the schema that answers those queries.',
    'This is supporting work, not the main event. A "good enough" schema keeps the conversation where it belongs. Sketch tables, keys, and index notes on the board and move on.',
  ],

  numbers: [
    { label: 'Default DB', value: 'PostgreSQL' },
    { label: 'Lives inside', value: 'high-level design (~10 min)' },
    { label: 'Entities → tables', value: 'roughly 1:1' },
    { label: 'Starting posture', value: 'normalized' },
  ],

  sections: [
    {
      heading: 'The six steps, in order',
      tone: 'good',
      points: [
        '1. Pick the database type (say "Postgres" and why in one sentence).',
        '2. List the columns each entity needs to satisfy the functional requirements — no more.',
        '3. Name primary keys and foreign keys for each relationship.',
        '4. Say which columns get indexes, and tie each index to an endpoint.',
        '5. Decide whether denormalization is actually needed. Usually not yet.',
        '6. Decide whether sharding is needed; if so, name the shard key and the access pattern it serves.',
        'Deliverable is a whiteboard sketch: tables, relationships, index notes. Not an ERD.',
      ],
    },
    {
      heading: 'Three factors that justify every choice',
      points: [
        'DATA VOLUME — how much there is, and therefore whether it fits on one box or must span stores.',
        'ACCESS PATTERNS — the most important of the three. Every endpoint implies a query; every hot query implies an index or a shape.',
        'CONSISTENCY — financial writes need ACID in one database; an activity feed can be eventually consistent and live somewhere else entirely.',
        'Say the linkage out loud. The lesson\'s own model sentence: "Since we need to load feeds quickly and likes can be eventually consistent, I\'ll denormalize like counts into the posts table." That is reasoning; a schema with no narration is memorisation.',
      ],
    },
    {
      heading: 'Keys, relationships, constraints',
      points: [
        'Primary keys are system-generated IDs (user_id, post_id), never business data like an email. Business rules change; surrogate keys do not.',
        'State it plainly and move on: "post_id is the primary key so comments and likes can reference it."',
        '1:N — a user has many posts. N:M — needs a join table (likes: user_id + post_id). 1:1 is rare and usually means the two tables should be one.',
        'Foreign keys buy referential integrity and cost write overhead. At very large scale some companies drop them and enforce integrity in the application — worth one sentence if scale is the theme.',
        'Constraints (NOT NULL, UNIQUE, CHECK) protect correctness at the database. Same trade: correctness for write cost.',
      ],
    },
    {
      heading: 'Indexes — connect each one to an endpoint',
      tone: 'good',
      points: [
        'Do not list indexes generically. Attach each to the query it serves: "GET /users/{id}/posts needs an index on posts.user_id."',
        'Index on posts.user_id → a user\'s posts. On posts.created_at → recent posts. Composite (user_id, created_at) → a user\'s recent posts, which is what the feed actually asks for.',
        'Composite column order matters: equality columns first, range/sort column last. Getting that right unprompted is a real signal.',
        'Indexes are not free — they cost write throughput and storage. Saying so pre-empts the follow-up.',
      ],
    },
    {
      heading: 'Normalize first, denormalize with a reason',
      points: [
        'Normalized means each fact lives in exactly one place. Start here. Repeating data in an initial schema reads as carelessness, not optimization.',
        'The canonical failure: copying username into the posts table. Now a username change means rewriting every post the user ever wrote, and one missed row is permanent inconsistency.',
        'Legitimate exceptions: analytics and reporting over slow-changing data; event logs and audit trails, which are deliberately point-in-time snapshots; read-optimized systems like search indexes where staleness is acceptable.',
        'The move interviewers like best: keep the source of truth normalized and put a cache in front holding the denormalized, pre-joined shape. You get read speed without corrupting the write model.',
      ],
    },
    {
      heading: 'Sharding — and the trap',
      tone: 'warn',
      points: [
        'Shard only once you have argued the data does not fit. Then pick a key that keeps related data together.',
        'Match the key to the dominant query: if reads are "posts by user", shard by user_id so a user\'s posts sit on one node.',
        'THE TRAP: sharding by time range for "recent posts". It sounds right and creates a hot shard — every current write lands on the newest range. Only sensible for archival or analytics workloads.',
        'Say this out loud: the shard key is effectively permanent and constrains every future query.',
        'Then name the query your key breaks. Sharded by user_id, a feed of many followed users becomes a scatter-gather across shards. Volunteering the downside is the senior move.',
      ],
    },
    {
      heading: 'Mistakes that cost you here',
      tone: 'warn',
      points: [
        'Choosing a graph database. "Almost never" is the lesson\'s own verdict — social networks and recommendations run fine on relational.',
        'Picking MongoDB for "evolving schemas" when interview requirements are, by construction, a small fixed set. The premise for document stores usually is not present.',
        'Producing a fully normalized ERD with twelve tables. Over-investment; you are burning high-level-design minutes.',
        'Listing indexes with no query attached.',
        'Sharding in minute three, before there is any volume argument for it.',
        'Silence. A schema drawn without narration cannot be distinguished from a memorised one.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'Relational vs document',
      a: 'Relational — fixed schema, joins, ACID, mature ops. Maps naturally onto almost every interview prompt.',
      b: 'Document — JSON-ish, flexible schema, embed instead of join, denormalize aggressively.',
      pick: 'Postgres, and justify moving off it rather than onto it. Document stores earn their place on genuinely evolving schemas or deeply nested data — conditions interview prompts rarely create.',
    },
    {
      axis: 'Relational vs key-value',
      a: 'Relational as the source of truth — queryable, consistent, joinable.',
      b: 'Key-value (Redis, DynamoDB) — exact-key lookups, extremely fast, no joins or cross-entity queries.',
      pick: 'Both, in the normal arrangement: SQL as source of truth with Redis in front for hot data. Pure key-value means duplicating data across keys per access pattern — fast reads, painful updates.',
    },
    {
      axis: 'Relational vs wide-column',
      a: 'Relational — general purpose, arbitrary queries.',
      b: 'Wide-column (Cassandra, HBase) — column families, huge write volume, time as a first-class dimension. Rows keyed (partition_key, timestamp), same partition stored contiguously.',
      pick: 'Wide-column when writes are enormous and append-shaped: telemetry, event logs, IoT, time-series analytics. Writes append to a partition, reads scan a contiguous range. Do not reach for it on a CRUD product.',
    },
    {
      axis: 'Normalized vs denormalized',
      a: 'Normalized — one fact in one place, no update anomalies, joins at read time.',
      b: 'Denormalized — pre-joined, fast reads, expensive and error-prone writes.',
      pick: 'Normalized in the database, denormalized in the cache. That answer gets both properties and shows you know which problem each solves.',
    },
  ],

  quickfire: [
    { q: 'Which database?', a: '"Postgres." Then one sentence on why the access pattern is relational. Only justify at length if you are picking something else.' },
    { q: 'What is your primary key?', a: 'A system-generated ID. Never email or any business value — those change.' },
    { q: 'How do you model likes?', a: 'Join table on (user_id, post_id) for N:M. Composite primary key on the pair also prevents double-liking for free.' },
    { q: 'Which indexes and why?', a: 'Name the endpoint each one serves. Composite (user_id, created_at) for a user\'s recent posts — equality column first, sort column last.' },
    { q: 'Would you denormalize?', a: 'Not in the source of truth. Cache the denormalized shape instead. Exceptions: analytics, audit logs, search indexes.' },
    { q: 'What is your shard key?', a: 'The dominant query\'s key — user_id if reads are per-user. Then name the query it breaks and how you would handle that.' },
    { q: 'Why not shard by time?', a: 'Hot shard — all writes land on the newest range. Fine for archival, wrong for a live write path.' },
    { q: 'Do you need foreign keys?', a: 'Yes by default, for referential integrity. At extreme write scale some drop them and enforce it in the app layer.' },
  ],
};
