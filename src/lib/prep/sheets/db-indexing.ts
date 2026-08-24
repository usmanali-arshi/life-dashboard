import type { DesignSheet } from '../types';

export const dbIndexing: DesignSheet = {
  slug: 'db-indexing',
  title: 'Database Indexing',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  sourceUrl: 'https://www.hellointerview.com/learn/system-design/core-concepts/db-indexing',
  tags: ['system-design', 'databases', 'b-tree', 'lsm', 'geospatial', 'search'],
  updated: '2026-08-24',

  gist: [
    'When in doubt, say B-tree. The lesson\'s own words: "B-trees are a safe bet." They handle equality AND range AND sort, which is why every database defaults to them.',
    'Exactly two exceptions worth knowing: geospatial data (geohash) and full-text search (inverted index). Everything else is a B-tree until proven otherwise.',
    'The graded instinct is knowing WHICH columns to index and WHY — tie each index to a query. Index internals only matter for infrastructure roles; product and full-stack interviews want the when, not the how.',
  ],

  numbers: [
    { label: 'Disk page', value: '~8 KB' },
    { label: 'B-tree fanout', value: 'hundreds of children' },
    { label: 'Reads to find a row', value: '2–3 pages' },
    { label: 'Quadtree split threshold', value: '4–8 points' },
    { label: 'Mid-level bar', value: 'basic strategies' },
    { label: 'Staff bar', value: 'types + tradeoffs' },
  ],

  sections: [
    {
      heading: 'Commonly missed — the exact claims people get backwards',
      tone: 'warn',
      points: [
        'SSDs did NOT make random access as fast as sequential. The lesson calls this out by name as a common misconception — the gap narrowed, it never closed, and on HDDs it is dramatic.',
        'Hash indexes are NOT the fast choice for lookups in general. B-trees handle equality almost as efficiently AND do ranges and sorting. Bruce Momjian: "Hash indexes solve a problem we rarely have."',
        'Indexes do not merely cost storage. Every insert and update writes to the table AND to every index on it — one write becomes several.',
        'LSM trees are not faster at everything. They deliberately trade READ performance for write throughput.',
        'An LSM tree is NOT a per-column index you add. It is the storage format for the whole table, sorted by primary key; secondary indexes need separate structures.',
        'DynamoDB does not switch storage engines based on access pattern. It is understood to be LSM-style; the internals are not public.',
        'A composite index on (a, b) does nothing for a query filtering on b alone. Only a LEFTMOST PREFIX of the column list is usable.',
        '"Most selective column first" is a heuristic, not a law. A frequently-sorted column can be worth including even when it is not selective, because it buys a free ORDER BY.',
        'Covering indexes are not a default win. The lesson calls them niche in 2026 — planners are good now, and the storage and maintenance cost is real.',
        'A B-tree cannot serve LIKE \'%term%\'. It only seeks on a known PREFIX; a leading wildcard forces a full scan. That is what inverted indexes exist for.',
        'A bloom filter answers "definitely not present" or "maybe present" — never "definitely present". False positives yes, false negatives no. Getting that direction backwards is a classic.',
        'Quadtrees are not the production standard for spatial data. R-trees are; quadtrees are the conceptual ancestor and are rare in modern databases.',
        'Two separate B-trees on latitude and longitude do NOT give you proximity search. Two 1-D indexes cannot express a 2-D relationship.',
        'More indexes is not monotonically better. Small tables and write-heavy, read-rare tables are actively worse off with them.',
      ],
    },
    {
      heading: 'Why indexes exist',
      points: [
        'Table data sits in a HEAP FILE — rows in no particular order, like a notebook written front to back.',
        'No index means scanning every page into memory. Millions of pages, millions of slow disk reads, to find one row.',
        'An index gives a structured path straight to the pages you need. Table of contents instead of reading the whole book.',
        'Random access is still much slower than sequential EVEN ON SSDs. Common misconception that SSDs erased the gap — the gap narrowed, it did not close.',
      ],
    },
    {
      heading: 'The cost — say this before they ask',
      tone: 'warn',
      points: [
        'Every index is extra disk, sometimes nearly as much as the table itself.',
        'Every write updates the table AND every index on it. Several indexes turn one insert into several disk writes.',
        'When indexes hurt: write-heavy, read-rare tables — a logging table is the classic. Also tiny tables, where scanning beats traversing.',
        'Nuance worth having ready: the MEMORY impact is often overblown, because modern buffer-pool management absorbs a lot. The write-throughput cost is the real one.',
        'Volunteering the write cost is what separates "I\'d add an index" from "I\'d add an index, and here is what it costs me."',
      ],
    },
    {
      heading: 'B-tree — the default',
      tone: 'good',
      points: [
        'Self-balancing, sorted, with hundreds of children per node — not two. All leaves at the same depth.',
        'Each node is sized to one disk page (~8 KB), so tree depth maps directly to disk reads. Finding id=350 is 2–3 page reads.',
        'Node rules: between m/2 and m keys, a node with k keys has exactly k+1 children, keys sorted within the node.',
        'Five reasons it wins: keeps sorted order (range queries, ORDER BY), self-balancing (predictable), matches disk page layout (minimal I/O), equally good at equality and range, and stays balanced under random writes.',
        'Postgres auto-creates a B-tree for every PRIMARY KEY and UNIQUE constraint — so `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR UNIQUE)` silently builds TWO indexes, not zero.',
        'MongoDB uses B+ TREES specifically — a variant where all data lives in the leaves, which is what makes leaf-to-leaf range scans cheap. Worth naming the distinction if asked.',
      ],
    },
    {
      heading: 'LSM tree — when writes dominate',
      points: [
        'Not an index you add to a column — it is the storage format for the whole table, sorted by primary key. Secondary indexes need separate structures.',
        'Write path: memtable in RAM (skip list / red-black tree) → append to a write-ahead log for durability → flush to an immutable SSTable when full → background compaction merges SSTables and drops deletes.',
        'The trick: many small RANDOM writes become few large SEQUENTIAL writes. That is the whole performance story.',
        'Reads get worse: a point query may check the memtable, frozen memtables, then many SSTables newest-first.',
        'Three mitigations, name them: bloom filters (probabilistically skip SSTables that definitely lack the key), sparse indexes (SSTables are sorted, so skip by key range), and compaction strategy (size-tiered = less write amplification, more files; leveled = fewer files, more rewriting).',
        'Right call for metrics ingestion, logs, IoT, time-series. Wrong call for a user-facing app where every page load fires several queries. Cassandra, RocksDB, and DynamoDB\'s storage are LSM-style.',
      ],
    },
    {
      heading: 'Hash index — know it, do not push it',
      tone: 'warn',
      points: [
        'A persistent hashmap: hash the value, land in a bucket, follow the pointer. O(1) exact match.',
        'Useless for ranges or sorting — hashing deliberately scatters nearby values.',
        'Postgres supports them but does not default to them, because per its own docs B-trees handle equality almost as efficiently while also doing ranges.',
        'Mostly an in-memory thing: Redis, MySQL MEMORY engine.',
        'The lesson warns explicitly: over-emphasising hash indexes makes you look out of touch with production practice. Mention and move on.',
      ],
    },
    {
      heading: 'Geospatial — specialised in practice, common in interviews',
      points: [
        'Why B-trees fail: lat and lng are two independent 1-D indexes, but proximity is a 2-D problem. Filtering by latitude gives you a strip circling the globe; intersecting both gives a rectangle much larger than your circle, then you still filter by distance.',
        'GEOHASH — recursively quarter the world, base32-encode the path. "9q8y" is San Francisco, "9q8yy" the Mission, "9q8yyk" a block. Nearby points share prefixes, so a plain B-tree prefix scan does proximity search. Redis GEOADD/GEOSEARCH works this way. Flaw: two points either side of a grid boundary share no prefix, so query adjacent cells too.',
        'QUADTREE — recursively split a square into four when it exceeds ~4–8 points. Adaptive resolution: dense areas subdivide further. Needs a bespoke structure, so rare in production databases now, but it is the ancestor of R-trees and how map tiles are organised.',
        'R-TREE — the production standard (PostGIS, MySQL). Flexible OVERLAPPING bounding rectangles fitted to the data rather than a fixed grid. Handles points and polygons in one index (restaurant pins + delivery zones + roads). Cost: overlap means sometimes searching several branches.',
        'If you learn only one, learn geohash.',
      ],
    },
    {
      heading: 'Inverted index — full-text search',
      points: [
        'A leading-wildcard LIKE \'%database%\' cannot use a B-tree at all. B-trees only help with a known prefix, so the database reads every row.',
        'Flip the mapping: instead of document → words, store word → documents. Exactly the index at the back of a textbook.',
        'Production versions run an analysis pipeline first: tokenize, lowercase, drop stop words, stem to root form. That is why searching "Databases" matches "database" and "database\'s".',
        'On top of that: term frequency, relevance scoring, fuzzy matching, phrase queries. Elasticsearch and Lucene.',
        'Cost: large storage overhead, and every document edit updates an entry for every term it contains.',
      ],
    },
    {
      heading: 'Composite indexes — the ordering rule',
      tone: 'good',
      points: [
        'One index on (user_id, created_at) beats two separate indexes the database has to intersect and then sort.',
        'The B-tree key is the concatenated tuple, sorted by user_id first, then created_at within each user. So you seek to the user, then scan forward through their dates — filtering AND sorting in one traversal, sort for free.',
        'ORDER MATTERS: (user_id, created_at) does nothing for a query filtering only on created_at. You can only use a PREFIX of the column list.',
        'Rule of thumb is "most selective first", but query pattern can beat selectivity — including a sort column that is not selective still buys you a free ORDER BY.',
        'Memorise three shapes: order history (customer_id, order_date) · event processing (status, priority, created_at) · activity feed (user_id, type, timestamp).',
      ],
    },
    {
      heading: 'Covering indexes — use sparingly',
      points: [
        'Add the columns the query RETURNS, not just the ones it filters on: `CREATE INDEX ... ON posts(user_id, created_at) INCLUDE (likes)`.',
        'The database answers entirely from the index — no trip to the heap for each row. Index-only scan.',
        'Cost is size, and the lesson calls it a niche optimization in 2026: modern query planners are good, and covering indexes add storage and maintenance.',
        'In an interview, reach for it only with a specific reason. Otherwise err toward simplicity.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'B-tree vs LSM tree',
      a: 'B-tree — in-place updates, 2–3 reads to find anything, balanced read/write workloads.',
      b: 'LSM — append-only, sequential writes, enormous write throughput; reads must check memtable plus many SSTables.',
      pick: 'B-tree for user-facing apps. LSM when writes vastly outnumber reads — metrics, logs, IoT, time-series. Name bloom filters and compaction as the things that make LSM reads survivable.',
    },
    {
      axis: 'B-tree vs hash index',
      a: 'B-tree — equality nearly as fast, plus ranges, sorting, prefix matching.',
      b: 'Hash — O(1) exact match, nothing else.',
      pick: 'B-tree, essentially always on disk. Hash only for in-memory exact-match stores. Do not dwell on it.',
    },
    {
      axis: 'Geohash vs R-tree',
      a: 'Geohash — 2-D collapsed to a 1-D string; rides on an ordinary B-tree, no special structure. Boundary cells need extra scans.',
      b: 'R-tree — hierarchical overlapping bounding boxes; handles points and polygons together, more accurate. Overlap can force multi-branch searches.',
      pick: 'Lead with geohash for simplicity, then contrast with R-trees — the lesson says explicitly that contrasting a hash-based with a tree-based approach is what demonstrates depth.',
    },
    {
      axis: 'More indexes vs faster writes',
      a: 'More indexes — every read path is covered.',
      b: 'Fewer indexes — cheaper writes, less storage, simpler.',
      pick: 'Index the queries you actually named. Say the write cost aloud, and call out the write-heavy tables (logs, events) where you would deliberately skip indexing.',
    },
  ],

  quickfire: [
    { q: 'Which index type?', a: '"B-tree." Two exceptions: geospatial → geohash; full-text → inverted index.' },
    { q: 'Why not just index latitude and longitude?', a: 'Two 1-D indexes cannot express 2-D proximity. Latitude alone returns a strip round the globe; intersecting both gives a rectangle far bigger than the circle you wanted.' },
    { q: 'Why is LIKE \'%foo%\' slow even with an index?', a: 'B-trees only seek on a known prefix. A leading wildcard forces a full scan — that is what inverted indexes are for.' },
    { q: 'Why does composite column order matter?', a: 'The index is sorted by the first column, then the second within it. Only a leftmost prefix of the columns is usable.' },
    { q: 'What does an index cost?', a: 'Storage plus a write to every index on every insert and update. Bad trade on write-heavy, read-rare tables.' },
    { q: 'How does an LSM tree stay readable?', a: 'Bloom filters skip SSTables that definitely lack the key, sparse indexes skip by key range, compaction keeps the file count down.' },
    { q: 'What is a covering index?', a: 'One that also holds the returned columns, so the query never touches the heap. Niche in 2026 — justify it or skip it.' },
    { q: 'Are SSDs random-access-fast now?', a: 'No. Sequential still beats random on SSDs — narrower gap, not a closed one.' },
    { q: 'What does a bloom filter actually tell you?', a: '"Definitely not here" or "maybe here". False positives are possible; false negatives are not.' },
    { q: 'Does (user_id, created_at) help a query on created_at alone?', a: 'No — leftmost prefix only. You would need a separate index.' },
    { q: 'How deep should I go here?', a: 'Infrastructure role: deep. Product or full-stack: know when and why to index, not B-tree internals.' },
  ],
};
