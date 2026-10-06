import type { PatternSheet } from '../types';

export const dynamicProgramming: PatternSheet = {
  slug: 'dynamic-programming',
  title: 'Dynamic Programming',
  kind: 'pattern',
  source: 'NeetCode 150, 1-D and 2-D DP',
  tags: ['dp', 'recursion', 'memoization', 'trees', 'grids', 'strings'],
  updated: '2026-10-06',

  triggers: [
    '"number of ways", "count the distinct", "minimum / maximum cost" over a sequence of choices',
    'Brute force is a recursion where each call makes 2 choices (skip/take, 1 digit/2 digits)',
    'The same suffix, prefix, or (i, j) pair would be recomputed in many branches',
    'Choices on item i only depend on a small summary of earlier or later items',
    '"Non-adjacent", "subsequence", "decode", "paths in a grid", "edit / match two strings"',
  ],

  routing: [
    { signal: 'Pick or skip items in a line, no two adjacent', use: 'A', why: 'State is one index, answer depends on the previous two. House Robber shape.' },
    { signal: 'Count ways to split a string into valid chunks', use: 'B', why: 'Each position tries a 1-char and a 2-char chunk. Add the results of the legal moves.' },
    { signal: 'Answer for n is built from the answer for a smaller number (n/2, n-1)', use: 'C', why: 'Fill a table 0..n and reuse earlier entries. Counting Bits shape.' },
    { signal: 'Grid, move only right/down, count paths or min cost', use: 'D', why: 'Cell depends on the cell above and the cell to the left. Two indices.' },
    { signal: 'Same problem on a tree, adjacency forbidden', use: 'E', why: 'Post-order. Each node returns a (take, skip) pair for its subtree.' },
    { signal: 'Two strings, subsequence or alignment between them', use: 'F', why: 'dp[i][j] over prefixes of both. Define one number per cell before anything else.' },
  ],

  template: [
    {
      id: 'A',
      label: 'Linear skip-or-take (House Robber)',
      when: 'One sequence, choosing items, adjacent choices conflict.',
      code: `def rob(xs):
    n = len(xs)
    if n == 0:
        return 0
    prev2, prev1 = 0, xs[0]            # dp[0], dp[1]; i = count of items considered
    for i in range(2, n + 1):
        cur = max(prev1, prev2 + xs[i - 1])   # skip vs take (item is xs[i-1])
        prev2, prev1 = prev1, cur
    return prev1`,
      note: 'With i meaning "count considered", the current item is xs[i-1]. That off-by-one confusion is the usual stumble.',
    },
    {
      id: 'B',
      label: 'Top-down with integer index and memo (Decode Ways)',
      when: 'Counting splits of a string. Each call tries a 1-wide and a 2-wide move.',
      code: `def num_decodings(s):
    memo = {}
    def helper(i):
        if i == len(s):                 # empty suffix = one finished decoding
            return 1
        if i in memo:
            return memo[i]
        if s[i] == "0":
            return 0
        ways = helper(i + 1)            # one-digit move, always legal here
        if i + 1 < len(s) and 10 <= int(s[i:i+2]) <= 26:
            ways += helper(i + 2)       # two-digit move, guarded
        memo[i] = ways
        return ways                     # return ways, NOT memo
    return helper(0)                    # 0 = nothing chopped, NOT len(s)`,
      note: 'Guards on terms, not hardcoded returns. A "return 1" on the one-digit check kills the recursion before the two-digit term is ever considered.',
    },
    {
      id: 'B2',
      label: 'Same problem bottom-up with two rolling variables',
      when: 'After B works. dp[i] reads only dp[i+1] and dp[i+2], so loop backwards.',
      code: `n = len(s)
next1, next2 = 1, 0                    # dp[i+1], dp[i+2]
for i in range(n - 1, -1, -1):
    if s[i] == "0":
        cur = 0
    else:
        cur = next1
        if i + 1 < n and 10 <= int(s[i:i+2]) <= 26:
            cur += next2
    next2 = next1                      # old next1 first
    next1 = cur
return next1                           # holds dp[0] after the last shift`,
      note: 'Use if/else, not continue. The shift lives at the bottom of the loop, and continue would skip it.',
    },
    {
      id: 'C',
      label: 'Table that reuses earlier answers (Counting Bits)',
      when: 'Answer for i is a cheap function of the answer for a smaller index.',
      code: `result = [0] * (n + 1)                # parentheses: [0] * n + 1 is a TypeError
for i in range(1, n + 1):
    result[i] = result[i // 2] + (i % 2)   # chop last bit, add it back`,
    },
    {
      id: 'D',
      label: 'Grid, 2D then 1D (Unique Paths)',
      when: 'Move right/down. Cell = above + left.',
      code: `dp = [[0] * n for _ in range(m)]       # never [[0]] * n, rows alias
for i in range(m): dp[i][0] = 1
for j in range(n): dp[0][j] = 1
for i in range(1, m):
    for j in range(1, n):
        dp[i][j] = dp[i-1][j] + dp[i][j-1]
return dp[m-1][n-1]

# one row: dp = [1] * n; for each row i>=1: for j>=1: dp[j] += dp[j-1]`,
      note: 'Before dp[j] += dp[j-1], dp[j] still holds the row above and dp[j-1] is already this row. Two scalars do not work because the "above" dependency changes with j.',
    },
    {
      id: 'E',
      label: 'Tree, post-order with a (take, skip) pair',
      when: 'Max sum of non-adjacent nodes. Any tree DP where a node has an "in" and "out" state.',
      code: `def helper(node):
    kids = [helper(c) for c in adjacency.get(node, [])]
    take = values[node] + sum(k[1] for k in kids)         # children must be skipped
    skip = sum(max(k[0], k[1]) for k in kids)             # children are free
    return (take, skip)

# root = the node that never appears in any child list
return max(helper(root))`,
      note: 'Sums over all children, not max over one. A leaf gives (value, 0), and max([]) on an empty child list crashes.',
    },
    {
      id: 'F',
      label: 'Two-sequence table with a stored start (Minimum Window Subsequence)',
      when: 'Shortest contiguous window of s1 that contains s2 as a subsequence.',
      code: `def min_window(s1, s2):
    n, m = len(s1), len(s2)
    # dp[i][j] = latest start in s1 of a window ending at s1[j-1]
    #            that contains s2[:i] as a subsequence, else -1
    dp = [[-1] * (n + 1) for _ in range(m + 1)]
    for j in range(n + 1):
        dp[0][j] = j                       # empty target: window starts where it ends
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[j-1] == s2[i-1]:
                dp[i][j] = dp[i-1][j-1]    # use this char as the i-th match
            else:
                dp[i][j] = dp[i][j-1]      # same window, one char longer
    best_len, best_start = float("inf"), -1
    for j in range(1, n + 1):              # strict < keeps the leftmost on ties
        if dp[m][j] != -1 and j - dp[m][j] < best_len:
            best_len, best_start = j - dp[m][j], dp[m][j]
    return "" if best_start == -1 else s1[best_start:best_start + best_len]`,
      note: 'Match: copy from up-left. No match: copy from left. Answer is a scan of the last row for the smallest j - dp[m][j].',
    },
  ],

  walkthrough: {
    title: 'Minimum Window Subsequence: s1 = "abcdebdde", s2 = "bde" gives "bcde"',
    steps: [
      {
        label: '1. Pin down the problem',
        body: 'Shortest contiguous substring of s1 that contains s2 as a subsequence (letters in order, gaps allowed). Return "" if none, leftmost on ties. "bdde" also works but ties and appears later, "bcdebdde" is longer.',
      },
      {
        label: '2. Finish the sentence (the step that blocked me)',
        body: 'dp[i][j] = the ______ of a window ending at s1[j-1] that contains s2[:i]. A window needs a start and an end, column j already fixes the end, so the cell stores the START index. Latest start is best because it gives the shortest window. -1 means no window.',
      },
      {
        label: '3. Base row',
        body: 'i = 0 means an empty target, matched by an empty window that starts where it ends. So dp[0][j] = j for every j.',
      },
      {
        label: '4. Recurrence',
        body: 'If s1[j-1] == s2[i-1], this char can be the i-th match, so the window start is whatever the window for s2[:i-1] ending at j-1 had: dp[i][j] = dp[i-1][j-1]. Otherwise the best window is the same one extended by a char: dp[i][j] = dp[i][j-1].',
        code: `if s1[j-1] == s2[i-1]: dp[i][j] = dp[i-1][j-1]
else:                  dp[i][j] = dp[i][j-1]`,
      },
      {
        label: '5. Read the answer',
        body: 'Last row (i=3): j=5 has start 1, length 4. j=9 has start 5, length 4. Tie, take the leftmost, so s1[1:5] = "bcde".',
        code: `i=3 (bde): -1 -1 -1 -1 -1  1  1  1  1  5   (j = 0..9)`,
      },
      {
        label: '6. Why the match case ignores dp[i][j-1]',
        body: 'Any window ending at j-1 that holds s2[:i] also holds s2[:i-1], so its start is at most dp[i-1][j-1]. Using the current char as the match gives an equal or later start, which is a shorter window.',
      },
      {
        label: '7. Reduce space, then compare methods',
        body: 'Row i reads only row i-1 and itself, so two rows give O(n) space. The alternative is two pointers: scan forward to match all of s2, then scan backward to tighten the start. Same O(m*n) worst case, worth being able to do both.',
      },
    ],
  },

  complexity: {
    time: 'States x work per state',
    space: 'States, or the width of what the recurrence reads',
    note: 'House Robber O(n) / O(1). Decode Ways O(n) / O(1). Unique Paths O(m*n) / O(n), closed form C(m+n-2, m-1). Tree O(V) / O(depth). Min Window Subsequence O(m*n) / O(n). Memoizing on a sliced string costs O(n) per state, so use an integer index.',
  },

  sections: [
    {
      heading: 'The framework, in order',
      tone: 'good',
      points: [
        '1. State: what changes between calls? That is the DP index. Slices collapse to an integer.',
        '2. Definition in one sentence: dp[i] = the best/count/start for ____. One number per cell.',
        '3. Recurrence from the first or last decision. Count problems add terms, best problems take max/min.',
        '4. Base case: ask what the empty input means. Empty string in Decode Ways is 1, not 0.',
        '5. Order: which indices does dp[i] read? i+1, i+2 means loop backwards.',
        '6. Answer location: dp[0], dp[n], dp[m-1][n-1], or a scan over the last row.',
      ],
    },
    {
      heading: 'The four-version ladder',
      tone: 'good',
      points: [
        'Brute recursion, matches the recurrence line for line.',
        'Top-down memo: lookup after the base case, store just before return.',
        'Bottom-up table: same recurrence, loop in dependency order.',
        'Space reduction: keep only the entries the loop body actually reads.',
      ],
    },
    {
      heading: 'Slice version to index version',
      points: [
        's == "" becomes i == len(s)',
        's[0] becomes s[i], s[0:2] becomes s[i:i+2]',
        'len(s) >= 2 becomes i + 1 < len(s)',
        'helper(s[1:]) becomes helper(i + 1), helper(s[2:]) becomes helper(i + 2)',
      ],
    },
    {
      heading: 'Bugs I actually made',
      tone: 'warn',
      points: [
        'Returning the wrong object: return memo instead of memo[i], return next2 instead of next1, return heapq earlier. Read every return and ask which name holds the value just computed.',
        'Terminal return instead of a guard: return 1 on the one-digit check stopped the recursion. Write ways = ...; if valid: ways += ...; return ways.',
        'Wrong dependency direction: dp[i-1] where the recurrence needs dp[i+1]. Python negative indices wrap silently, so this gives wrong answers instead of crashing.',
        'continue in a loop that shifts rolling variables at the bottom skips the shift. Use if/else.',
        'Precedence and syntax: [0] * n+1, missing colons, dep for dp, unprefixed self. calls, else misaligned with if, [[0] for _ in range(m)] making rows of length 1.',
        'Starting the memo at helper(len(s)), which is the base case, instead of helper(0).',
        'Tree: max over one child instead of a sum over all children, and using values inside a function whose parameter was named vertices.',
        'Min Window: defined dp[i][j] as "the indices where letters show up", which is not one number per cell.',
      ],
    },
    {
      heading: 'Hand-trace before submitting',
      tone: 'good',
      points: [
        'One input per base case and one per branch.',
        'Decode Ways: "", "0", "10", "27", "12", "226", "100".',
        'Print the table or rolling variables after each iteration and check against the full table version.',
        'Empty input: dp[1] = xs[0] needs a guard for n == 0.',
      ],
    },
  ],

  problems: [
    { name: 'Climbing Stairs', difficulty: 'Easy', twist: 'The Fibonacci skeleton. Warm-up for the two-variable roll.' },
    { name: 'House Robber', difficulty: 'Medium', twist: 'Skip or take. i as a count means the item is xs[i-1].' },
    { name: 'Counting Bits', difficulty: 'Easy', twist: 'Reuse result[i // 2]. Bottom-up from the start.' },
    { name: 'Decode Ways', difficulty: 'Medium', twist: 'Guards on terms, empty string is 1, zero is a dead end.' },
    { name: 'Unique Paths', difficulty: 'Medium', twist: '2D table to one row. Closed form is the follow-up.' },
    { name: 'House Robber III (tree)', difficulty: 'Medium', twist: 'Post-order (take, skip) pair, sum over all children.' },
    { name: 'Minimum Window Subsequence', difficulty: 'Hard', twist: 'Store the start index, not a boolean. Not cracked yet, redo from the walkthrough.' },
  ],
};
