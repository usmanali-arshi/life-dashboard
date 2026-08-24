import type { DesignSheet } from '../types';

export const sharding: DesignSheet = {
  slug: 'sharding',
  title: 'Sharding',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  sourceUrl: 'https://www.hellointerview.com/learn/system-design/core-concepts/sharding',
  tags: ['system-design', 'databases', 'scaling', 'consistent-hashing', 'partitioning'],
  updated: '2026-08-24',

  gist: [
    'Do the capacity math BEFORE you shard. The named mistake in this lesson is introducing sharding before proving it is necessary — same failure shape as reaching for a cache with no bottleneck.',
    'The shard key is effectively permanent and constrains every query you will ever write. Choose it from the dominant access pattern, then say out loud which query it breaks.',
    'Default answer: hash-based on the entity your queries centre on, with consistent hashing so you can add capacity later. Then name the global query that now costs a scatter-gather, and cache or pre-compute it.',
  ],

  numbers: [
    { label: 'Single Postgres', value: '~2 TB before concern' },
    { label: 'Aurora ceiling', value: '256 TiB' },
    { label: 'Fine on one box', value: '~2.5 TB' },
    { label: 'Must shard', value: '~25 TB' },
    { label: 'Write pressure', value: '50K writes/sec' },
    { label: 'Sensible start', value: '64 shards' },
  ],

  sections: [
    {
      heading: 'Prove the need first — the capacity argument',
      tone: 'good',
      points: [
        'STORAGE: 2.5 TB fits on one instance comfortably. 25 TB does not. Do that division out loud — bytes per row × rows per day × retention.',
        'WRITE THROUGHPUT: around 50K writes/sec is where a single primary stops coping. Reads scale with replicas; writes do not, which is why write volume is usually what forces the decision.',
        'READ THROUGHPUT: 100M DAU each firing several queries per session eventually needs distribution — but try replicas and a cache first.',
        'Say the ceiling: a single Postgres gets uncomfortable around 2 TB, and Aurora tops out at 256 TiB. Naming a real limit is what turns "it is big" into an argument.',
        'Order of escalation: index → cache → read replicas → THEN shard. Sharding is the last resort because it is the only one that changes your query model permanently.',
      ],
    },
    {
      heading: 'Vocabulary that gets graded',
      points: [
        'PARTITIONING splits data within a single database instance. SHARDING splits it across multiple machines. Using them interchangeably is a small, avoidable tell.',
        'HORIZONTAL partitioning splits ROWS (orders by year). VERTICAL splits COLUMNS. Sharding discussions are essentially always horizontal.',
        'Vertical SCALING = a bigger box. Horizontal SCALING = more boxes. Sharding is how a database does the second one.',
      ],
    },
    {
      heading: 'Choosing the shard key — three properties, all required',
      tone: 'good',
      points: [
        'HIGH CARDINALITY — millions of distinct values. A boolean gives you exactly two possible shards, so it can never spread load.',
        'EVEN DISTRIBUTION — values spread roughly uniformly, so no shard absorbs a disproportionate share.',
        'QUERY ALIGNMENT — your most common query should be answerable from ONE shard. This is the property people forget, and it is the one that decides whether the design works.',
        'Good keys: user_id for user-centric products, order_id for e-commerce.',
        'Bad keys: any boolean; created_at or any timestamp, because every new write lands on the newest range and you have built a hot shard on purpose.',
        'Then volunteer the cost. Sharded by user_id, a feed spanning many followed users becomes a cross-shard scatter-gather. Naming your own downside is the senior move.',
      ],
    },
    {
      heading: 'Distribution strategies',
      points: [
        'HASH-BASED (the default) — `shard = hash(user_id) % N`. Distribution is even essentially for free. Weakness: changing N reshuffles almost everything, which is exactly the problem consistent hashing solves. Say "hash-based with consistent hashing" as one phrase.',
        'RANGE-BASED — user IDs 1–1M to shard 1, and so on. Genuinely good for multi-tenant systems where a customer owns a contiguous range, because a tenant\'s data stays together. Bad for time-series: recent writes all crowd one shard.',
        'DIRECTORY-BASED — a lookup table mapping key to shard. Maximum flexibility, including moving individual hot keys. Costs a lookup on every request and introduces a single point of failure. The lesson\'s verdict: rarely the answer in an interview.',
        'Pick hash-based unless the prompt hands you a tenant model (→ range) or an explicit need to relocate individual keys (→ directory).',
      ],
    },
    {
      heading: 'Hot spots and the celebrity problem',
      tone: 'warn',
      points: [
        'Even a perfect hash cannot save you from skewed ACCESS. Taylor Swift\'s profile can take 1000× normal traffic while sitting on one shard.',
        'Even distribution of DATA and even distribution of LOAD are different problems. Say that distinction — it is the insight the celebrity question is testing.',
        'Fixes: isolate hot keys onto dedicated shards; use a COMPOUND shard key such as `hash(user_id + date)` to spread one entity across shards; enable dynamic shard splitting (MongoDB\'s balancer does this automatically).',
        'Also fair: cache the hot key hard, or replicate it, so most reads never reach the shard at all. Ties directly to the hot-key section of the caching sheet.',
      ],
    },
    {
      heading: 'Cross-shard queries — the thing to design around',
      points: [
        '"Top 10 posts globally" against 64 shards means querying all 64 and merging — scatter-gather. Latency is bounded by the slowest shard, not the average.',
        'The lesson\'s framing is worth memorising: cross-shard operations are often a SIGNAL THAT SOMETHING IN THE DESIGN NEEDS RETHINKING. Treat one as a prompt to reconsider the key, not just a cost to absorb.',
        'Three legitimate responses: pre-compute and cache the result and accept eventual consistency; denormalise so the related data lives on the same shard; or accept the slow path for a genuinely rare query.',
        'Best framing in an interview: "trending posts are pre-computed and cached, so we never fan out across shards on the read path."',
      ],
    },
    {
      heading: 'Transactions across shards',
      points: [
        'Two-phase commit exists, and it is fragile and slow. Know the name; do not reach for it.',
        'FIRST CHOICE: avoid the problem. Co-locate everything one transaction touches on a single shard — that is a shard-key decision, made earlier.',
        'SECOND: the SAGA pattern — a sequence of local transactions, each with a compensating action to undo it if a later step fails.',
        'THIRD: accept eventual consistency for anything non-critical — counters, denormalised fields, aggregates.',
        'Notice the ranking: the good answer is a design that does not need distributed transactions, not a clever distributed transaction.',
      ],
    },
    {
      heading: 'What real systems do — name-drop precisely',
      points: [
        'CASSANDRA — Murmur3Partitioner with virtual nodes, i.e. consistent hashing.',
        'DYNAMODB — hashes the partition key, splits and merges partitions automatically.',
        'MONGODB — range-based chunks with an automatic balancer that also splits hot chunks.',
        'VITESS and CITUS — sharding layers bolted onto MySQL and PostgreSQL respectively, which is the realistic answer to "we outgrew Postgres but want to keep it".',
        'Useful thing to say: you will not implement sharding from scratch. Choosing the key and the strategy is the engineering; the mechanics are the database\'s job.',
      ],
    },
    {
      heading: 'The four sentences to say',
      tone: 'good',
      points: [
        '1. "Most queries here are user-centric, so I will shard by user_id."',
        '2. "Hash-based with consistent hashing, so adding capacity does not reshuffle everything."',
        '3. "The cost is global queries — trending posts would hit every shard, so I will pre-compute and cache those."',
        '4. "For growth, consistent hashing lets me add shards while moving only a fraction of the keys."',
        'Access pattern → strategy → the trade-off you accept → the growth plan. That is the whole section, in about thirty seconds.',
      ],
    },
    {
      heading: 'How candidates lose points',
      tone: 'warn',
      points: [
        'Sharding before proving it is needed. The explicitly named mistake.',
        'A shard key with no stated access pattern behind it.',
        'Never mentioning the query the key breaks.',
        'Sharding on a timestamp, then not noticing the hot shard you just designed.',
        'Assuming even data distribution means even load — the celebrity problem.',
        'Proposing 2PC as the answer to cross-shard writes instead of designing them away.',
        'Saying "partitioning" when you mean "sharding".',
        'Skipping the resharding story. "How do you add a shard later?" is a standard follow-up; consistent hashing is the answer.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'Hash vs range sharding',
      a: 'Hash — even distribution nearly for free; no range scans; resharding hurts without consistent hashing.',
      b: 'Range — contiguous keys stay together, so tenant and range queries are cheap; skew and hot shards are easy to create.',
      pick: 'Hash by default, with consistent hashing. Range only when the prompt hands you a tenant boundary. Never range on time for a live write path.',
    },
    {
      axis: 'Directory vs algorithmic assignment',
      a: 'Directory — a lookup table; any key can be moved anywhere, so hot keys are relocatable.',
      b: 'Hash or range — computed, no lookup, no extra dependency.',
      pick: 'Algorithmic. Directory adds a hop to every request and a single point of failure, and the lesson calls it rarely the interview answer. Mention it only when the problem is specifically about relocating individual hot keys.',
    },
    {
      axis: 'Cross-shard consistency: 2PC vs saga vs eventual',
      a: '2PC — real atomicity across shards; fragile, slow, blocks on coordinator failure.',
      b: 'Saga — local transactions plus compensating actions; resilient, but you must design the undo for every step.',
      pick: 'Avoid the need first by co-locating the data. If you cannot, saga. Reserve 2PC for naming, not for proposing. Eventual consistency is fine for counters and denormalised fields.',
    },
    {
      axis: 'Shard vs replicate vs cache',
      a: 'Sharding — the only one that scales WRITES and total storage. Permanently constrains your queries.',
      b: 'Replicas and caches — scale READS cheaply, change nothing about your query model.',
      pick: 'If the pressure is reads, use replicas and a cache. Shard when storage or write throughput is the wall. Getting this order right is most of the grade in this section.',
    },
  ],

  quickfire: [
    { q: 'When do you shard?', a: 'After the capacity math. Roughly: >25 TB of storage, or ~50K writes/sec. Under a few TB, one instance plus replicas is fine.' },
    { q: 'What is your shard key?', a: 'The entity the dominant query centres on — usually user_id. High cardinality, even spread, single-shard reads.' },
    { q: 'Which strategy?', a: '"Hash-based with consistent hashing." Range only for multi-tenant.' },
    { q: 'Why not shard by timestamp?', a: 'Every new write lands on the newest range. You have built a hot shard deliberately.' },
    { q: 'What about celebrities?', a: 'Even data distribution is not even load. Isolate the key onto its own shard, use a compound key like hash(user_id + date), or cache it hard.' },
    { q: 'How do you handle a global "top 10" query?', a: 'Do not scatter-gather on the read path. Pre-compute and cache it, and accept eventual consistency.' },
    { q: 'Cross-shard transaction?', a: 'Design it away by co-locating the data. Otherwise saga with compensating actions. 2PC is fragile and slow.' },
    { q: 'How do you add a shard later?', a: 'Consistent hashing — only a fraction of keys move, instead of nearly all of them under a modulo scheme.' },
    { q: 'Partitioning or sharding?', a: 'Partitioning is within one instance; sharding is across machines. Say the right one.' },
  ],
};
