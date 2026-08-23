import type { DesignSheet } from '../types';

export const apiDesign: DesignSheet = {
  slug: 'api-design',
  title: 'API Design',
  kind: 'design',
  source: 'Hello Interview — Core Concepts',
  sourceUrl: 'https://www.hellointerview.com/learn/system-design/core-concepts/api-design',
  tags: ['system-design', 'rest', 'graphql', 'grpc', 'security'],
  updated: '2026-08-22',

  gist: [
    'This is a 5-minute step, and the classic failure is OVER-investing in it. Nobody has ever failed for a slightly imperfect endpoint; plenty have failed for burning 15 minutes here and never reaching the architecture.',
    'Default to REST and say so out loud. "I\'ll use REST" is a complete answer — you only need a justification when you pick something else.',
    'One endpoint per functional requirement. If a requirement has no endpoint, you dropped it; if an endpoint has no requirement, you invented scope.',
  ],

  numbers: [
    { label: 'Time budget', value: '~5 min' },
    { label: 'Default protocol', value: 'REST' },
    { label: 'Endpoints', value: '1 per FR' },
    { label: 'Matters most for', value: 'product / frontend / junior' },
  ],

  sections: [
    {
      heading: 'Resources, not actions — the thing they actually grade',
      tone: 'good',
      points: [
        'Endpoints name THINGS; the HTTP method supplies the verb. `POST /bookings`, never `POST /createBooking`.',
        'Plural nouns throughout: `/events`, `/tickets`, `/bookings`.',
        'Path params for required structure and ownership: `/events/{id}/tickets`.',
        'Query params for optional filtering: `/tickets?event_id=123&section=VIP`.',
        'Body for the complex payload. The three can combine: `POST /events/123/bookings?notify=true` with a JSON body.',
        'Never accept userId as a parameter — it comes from the auth token. Taking it from the client is an authorization hole, and interviewers watch for exactly this.',
      ],
    },
    {
      heading: 'Methods and idempotency',
      points: [
        'GET retrieve · idempotent. POST create · NOT idempotent. PUT full replace · idempotent. PATCH partial · varies. DELETE · idempotent.',
        'Why it matters, in one line you should be able to say verbatim: "networks fail mid-request, and the client has no idea whether the server did the work."',
        'So every non-idempotent write needs a safe retry story. That story is the idempotency key.',
        'Status codes: 200 ok, 201 created, 400 bad request, 401 unauthenticated, 403 forbidden, 404 missing, 429 rate limited, 500 server error. Knowing 4xx-is-you vs 5xx-is-me beats reciting the full table.',
      ],
    },
    {
      heading: 'Idempotency keys — the single highest-signal thing here',
      tone: 'good',
      points: [
        'Client generates a UUID per logical operation and sends it as an `Idempotency-Key` header.',
        'Server stores key → result on first execution. An identical retry returns the stored response instead of re-running the work.',
        'Raise it unprompted on anything involving payments, bookings, or orders. It signals you think about failure modes, not just the happy path.',
        'Phrase it concretely, tied to the product: "I\'ll use an idempotency key so a retry can\'t double-book." That lands; an abstract lecture on idempotency does not.',
      ],
    },
    {
      heading: 'Pagination, filtering, sorting',
      points: [
        'Paginate anything that grows, from day one, with a max page size. Remembering to paginate at all counts for more than which scheme you pick.',
        'Offset (`?offset=20&limit=10`) — simple, intuitive, fine as a default. Breaks under writes: rows shift, so you get duplicates and gaps.',
        'Cursor (`?cursor=cmd9atj3p...&limit=10`) — stable pointer, immune to inserts, better for real-time or high-volume feeds. Cost: no "jump to page 5".',
        'Filter: `?city=NYC&status=upcoming`. Sort: `?sort=date`, `?sort=-date` for descending.',
        'Consistency is the graded part — pick `status` and use `status` on every endpoint. Mixing `status` and `state` is the kind of sloppiness they notice.',
      ],
    },
    {
      heading: 'Errors and versioning',
      points: [
        'One error envelope everywhere: a stable machine code plus a human message. `{"error":{"code":"SEAT_UNAVAILABLE","message":"Section VIP has only 1 seat remaining"}}`.',
        'The code is what clients branch on, so it never changes; the message is for humans and can be reworded freely.',
        'Versioning: use URL versioning (`/v1/events`). Widely understood, trivially testable in a browser.',
        'Header versioning (`Accept-Version: v2`) is cleaner and more RESTful, but less obvious — only bring it up if asked.',
        'Reality check: most interviewers do not prioritise versioning at all. Mention it in a sentence and move on unless pushed.',
      ],
    },
    {
      heading: 'Security — one line each, then move on',
      points: [
        'Authentication = who you are. Authorization = what you may do. Say both; candidates routinely conflate them.',
        'JWT for user sessions: claims signed with a secret, so any service verifies independently with no DB lookup. That is what makes it work in a distributed system.',
        'API keys (`Authorization: Bearer sk_live_...`) for server-to-server and third-party developers — never for end users, who should not be handling random strings.',
        'RBAC: roles hold permissions, users hold roles. Always check BOTH — valid token AND owns-this-resource-or-is-admin.',
        'Rate limiting: per-user, per-IP for anonymous, and tighter on abuse-prone endpoints (e.g. 10 booking attempts/min against scalping). Return 429.',
        'Naming rate limiting shows production thinking. Do NOT design the algorithm unless asked — that is a separate deep dive.',
      ],
    },
    {
      heading: 'Ways candidates lose time or points here',
      tone: 'warn',
      points: [
        'Spending 15 minutes perfecting endpoints. This is THE mistake for this section — over-investment, not under-investment.',
        'Designing internal service-to-service RPC during the API step. Only user-facing APIs belong here; mention internal gRPC later, during high-level design.',
        'Action-shaped endpoints: `/getUserBookings`, `/cancelBooking`.',
        'Reaching for GraphQL with no prompting, then getting buried in the N+1 follow-up.',
        'Listing endpoints in silence. Narrate one decision per endpoint — that is the entire difference between a listing and a design.',
        'Omitting pagination on a list endpoint.',
      ],
    },
  ],

  tradeoffs: [
    {
      axis: 'REST vs GraphQL',
      a: 'REST — resource-shaped, HTTP semantics for free, cacheable, universally understood.',
      b: 'GraphQL — one endpoint, client specifies the exact response shape, kills over- and under-fetching.',
      pick: 'REST, unless the interviewer plants the signal: "the mobile app needs different data than web", "diverse clients", "over-fetching". If you do pick GraphQL, pre-empt the N+1 problem — 100 events with venues is 101 queries unless you batch with a dataloader. They WILL ask.',
    },
    {
      axis: 'REST vs gRPC',
      a: 'REST/JSON — human-readable, browser-native, the right default for anything a client calls.',
      b: 'gRPC — protobuf over HTTP/2, binary, much faster, compile-time types across languages, bidirectional streaming.',
      pick: 'REST at the edge, gRPC internally between services. Signals for gRPC: "microservices", "internal APIs", "high performance". Raise it during high-level design, not during the API step.',
    },
    {
      axis: 'Request/response vs persistent connection',
      a: 'Plain HTTP — everything the client initiates.',
      b: 'WebSocket (bidirectional) or SSE (server→client only) — chat, notifications, live updates.',
      pick: 'SSE when only the server pushes; it is simpler, runs over plain HTTP, and reconnects on its own. WebSocket when the client also streams. Picking SSE for a notification feed and saying why is a small, cheap differentiator.',
    },
    {
      axis: 'Offset vs cursor pagination',
      a: 'Offset — simple, supports jumping to an arbitrary page.',
      b: 'Cursor — stable under concurrent writes, constant cost at any depth.',
      pick: 'Offset is fine by default. Switch to cursor for real-time or high-volume feeds, and name the reason: rows shift under offset, so users see duplicates and miss records.',
    },
  ],

  quickfire: [
    { q: 'Which protocol?', a: '"REST." Say it in two seconds and move on. Justify only when choosing something else.' },
    { q: 'Why is this endpoint POST and not PUT?', a: 'POST creates a new subordinate resource and is not idempotent; PUT replaces a resource at a known URI and is. If the client picks the ID, PUT is defensible.' },
    { q: 'How do you stop a double booking on retry?', a: 'Idempotency key header; server stores key → result and replays the stored response on a repeat.' },
    { q: 'How do you know who the user is?', a: 'JWT in the Authorization header, verified by signature — no DB round trip. Never a userId parameter.' },
    { q: 'How do you paginate?', a: 'Cursor with a capped limit; the response returns the next cursor. Offset is acceptable if the data is not shifting under you.' },
    { q: 'What happens when a client sends garbage?', a: '400 with the standard error envelope — stable code for branching, human message for the developer.' },
    { q: 'How do you add a field without breaking clients?', a: 'Adding is safe; renaming and removing are not. That is what /v2 is for.' },
    { q: 'Should I show internal APIs?', a: 'No. User-facing only during this step. Internal gRPC comes up in high-level design, if at all.' },
  ],
};
