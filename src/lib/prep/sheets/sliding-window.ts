import type { PatternSheet } from '../types';

export const slidingWindow: PatternSheet = {
  slug: 'sliding-window',
  title: 'Sliding Window',
  kind: 'pattern',
  source: 'Hello Interview — Coding Patterns',
  tags: ['arrays', 'strings', 'two-pointers'],
  updated: '2026-08-22',

  triggers: [
    '"contiguous subarray" or "substring" — contiguous is the whole tell',
    '"longest / shortest / maximum / minimum" over that contiguous range',
    'A constraint that gets *worse* as the window grows (sum > k, > 2 distinct chars)',
    'Brute force is the obvious O(n²) nested loop over every start and end',
    '"at most K" — almost always a variable window; "exactly K" — see the trick below',
  ],

  template: [
    {
      label: 'Variable window — longest valid (the one to memorise)',
      code: `def longest(s):
    left = 0
    state = {}              # whatever "valid" needs: counts, sum, distinct
    best = 0

    for right, ch in enumerate(s):
        state[ch] = state.get(ch, 0) + 1        # 1. admit s[right]

        while not_valid(state):                  # 2. shrink until valid again
            state[s[left]] -= 1
            if state[s[left]] == 0:
                del state[s[left]]
            left += 1

        best = max(best, right - left + 1)       # 3. record AFTER restoring validity
    return best`,
      note: 'The while loop is the whole pattern. `if` instead of `while` is the single most common bug — one shrink is not always enough to restore validity.',
    },
    {
      label: 'Variable window — shortest valid (flip two lines)',
      code: `def shortest(s):
    left = 0
    best = float('inf')

    for right in range(len(s)):
        admit(s[right])

        while is_valid(state):        # valid, so try to shrink and still be valid
            best = min(best, right - left + 1)   # record BEFORE evicting
            evict(s[left])
            left += 1

    return 0 if best == float('inf') else best`,
      note: 'Longest: shrink while INVALID, record after. Shortest: shrink while VALID, record before. Getting these backwards is the second most common bug.',
    },
    {
      label: 'Fixed window of size k',
      code: `def fixed(nums, k):
    total = sum(nums[:k])
    best = total
    for right in range(k, len(nums)):
        total += nums[right] - nums[right - k]   # admit one, evict one
        best = max(best, total)
    return best`,
      note: 'No while loop at all — the window never changes size, so left is implied by right - k.',
    },
    {
      label: '"Exactly K" — the subtraction trick',
      code: `def exactly_k(nums, k):
    return at_most(nums, k) - at_most(nums, k - 1)`,
      note: 'Exactly-K windows are not monotonic, so a single window cannot solve them directly. At-most-K is monotonic. Two passes, subtract. This one line converts a Hard into a Medium — say it out loud when you spot it.',
    },
  ],

  complexity: {
    time: 'O(n)',
    space: 'O(k) — the state map, bounded by window contents (O(1) for a fixed alphabet)',
    note: 'Each element is admitted exactly once and evicted at most once, so the inner while is amortised O(1). Say "amortised" — interviewers listen for it, because the nested loop *looks* quadratic.',
  },

  sections: [
    {
      heading: 'Say this before you write code',
      tone: 'good',
      points: [
        '"Brute force is O(n²) — every start, every end. But when I extend the window, I already know everything about the previous one, so I should reuse it."',
        'That sentence justifies the pattern and buys you thinking time. It is the same opener for every sliding-window problem.',
        'Then state the invariant explicitly: "the window [left, right] always satisfies X". Now the code writes itself.',
      ],
    },
    {
      heading: 'The precondition nobody states',
      tone: 'warn',
      points: [
        'Sliding window needs MONOTONICITY: growing the window must only ever push you toward invalid, shrinking only toward valid.',
        'Negative numbers break this for sum problems — a longer window can have a smaller sum. "Subarray sum equals K" with negatives is a prefix-sum + hashmap problem, NOT sliding window.',
        'If an interviewer adds "the array may contain negatives" mid-problem, that is the trapdoor. Recognising it is the whole point of the follow-up.',
      ],
    },
    {
      heading: 'Bugs that cost the interview',
      tone: 'warn',
      points: [
        '`if` instead of `while` when shrinking — passes the sample, fails a hidden case.',
        'Recording `best` at the wrong moment (see the two templates above).',
        'Forgetting to delete zero-count keys when the answer depends on `len(state)` for distinct-character counts.',
        'Off-by-one in window size: it is `right - left + 1`, always.',
        'Empty input — `best` stays at its initial value; make sure that value is correct, not just unset.',
      ],
    },
    {
      heading: 'Neighbouring patterns — do not confuse them',
      points: [
        'Two pointers converging from both ends → sorted array, pair-sum. Different pattern.',
        'Prefix sums + hashmap → non-contiguous constraints, or sums with negatives.',
        'Monotonic deque → sliding window where you need the max/min INSIDE the window (that is the "Sliding Window Maximum" upgrade).',
      ],
    },
  ],

  problems: [
    { name: 'Maximum Average Subarray I', difficulty: 'Easy', twist: 'Pure fixed window. Warm-up — write it in 3 minutes or your template is not automatic yet.' },
    { name: 'Contains Duplicate II', difficulty: 'Easy', twist: 'Fixed window + a set. Teaches evicting from state, not just from a sum.' },
    { name: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', twist: 'The canonical variable window. If you know one problem here, know this one.' },
    { name: 'Longest Repeating Character Replacement', difficulty: 'Medium', twist: 'Validity is `window_len - max_freq <= k`. The clever bit: max_freq never needs to decrease, which most people miss.' },
    { name: 'Permutation in String', difficulty: 'Medium', twist: 'Fixed window + frequency-map equality. Compare maps in O(1) by tracking a match counter instead of re-comparing.' },
    { name: 'Fruit Into Baskets', difficulty: 'Medium', twist: 'Literally "longest subarray with at most 2 distinct" in costume. Recognising the disguise is the skill.' },
    { name: 'Minimum Size Subarray Sum', difficulty: 'Medium', twist: 'The shortest-valid template. Note the positive-integers precondition in the constraints — that is what makes it legal.' },
    { name: 'Subarrays with K Different Integers', difficulty: 'Hard', twist: 'The at_most(k) - at_most(k-1) trick. Hard only until you know that line.' },
    { name: 'Minimum Window Substring', difficulty: 'Hard', twist: 'Shortest-valid with a "how many chars are satisfied" counter so validity is O(1). The classic on-site final boss.' },
    { name: 'Sliding Window Maximum', difficulty: 'Hard', twist: 'Not really this pattern — needs a monotonic deque. Included so you notice when the template does NOT apply.' },
  ],
};
