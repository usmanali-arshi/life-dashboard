import type { PatternSheet } from '../types';

export const stack: PatternSheet = {
  slug: 'stack',
  title: 'Stack & Monotonic Stack',
  kind: 'pattern',
  source: 'Hello Interview — Coding Patterns',
  sourceUrl: 'https://www.hellointerview.com/learn/code/stack/overview',
  tags: ['stack', 'monotonic-stack', 'strings', 'arrays', 'parsing'],
  updated: '2026-08-24',

  triggers: [
    'NESTED structure — brackets, tags, encoded strings, directories. The innermost thing resolves first, which is literally LIFO.',
    '"Matching" / "balanced" / "well-formed" / "valid" over paired symbols.',
    '"Next greater" / "next smaller" / "first taller to the right" → monotonic stack.',
    '"How many days until…" / "how far until a bigger value" → monotonic stack, storing INDEXES.',
    'Histogram, skyline, rectangle, trapped water — 2-D shapes built out of bar heights.',
    'Brute force is O(n²) with an inner "scan rightward until I find something bigger" loop. That inner loop is exactly what a monotonic stack deletes.',
    'You need to undo or unwind the most recent thing — collisions, path segments, backspaces.',
  ],

  routing: [
    { signal: 'Paired symbols: (), [], {}, HTML tags', use: 'A', why: 'Only the bracket TYPE matters, so the stack holds characters. No indexes, no arithmetic.' },
    { signal: 'Nested repetition: 3[a2[c]], nested tags with content', use: 'B', why: 'You must park an outer partial result and resume it later. The stack holds parked context, usually two values per level.' },
    { signal: '"Next greater / smaller element", "next warmer day"', use: 'C', why: 'One answer per element, resolved by a later element. Store indexes so you can write into result and measure distance.' },
    { signal: 'Width or span between boundaries — histogram, rectangle, trapped water', use: 'D', why: 'You need BOTH boundaries of each bar. The incoming element is the right one; the item beneath on the stack is the left one.' },
    { signal: 'Longest valid run of brackets, index arithmetic over a run', use: 'E', why: 'The stack holds indexes and its bottom is a base marker, not a bracket. Length is current index minus last unmatched opener.' },
    { signal: 'Arithmetic expression: + - * / and parentheses', use: 'F', why: 'Defer low-precedence operations onto the stack, apply high-precedence ones immediately, sum at the end.' },
    { signal: '"Get the min / max in O(1)" alongside push and pop', use: 'G', why: 'Store a tuple per entry so each level carries its own answer. Computed on push, never recomputed.' },
    { signal: 'Elements destroy or cancel each other — asteroids, backspaces, adjacent duplicates', use: 'H', why: 'The incoming element fights the top. Three outcomes, so the loop needs an explicit "did it survive" flag.' },
  ],

  template: [
    {
      id: 'A',
      label: 'Matching pairs',
      when: 'Valid Parentheses, Valid Tags. The stack holds characters — no indexes needed.',
      code: `def isValid(s):
    stack = []
    pairs = {")": "(", "}": "{", "]": "["}     # closer -> opener

    for ch in s:
        if ch in pairs:                        # a CLOSER
            if not stack or stack.pop() != pairs[ch]:
                return False
        else:                                  # an OPENER
            stack.append(ch)

    return not stack        # leftovers means unclosed openers`,
      note: 'Key the map closer→opener, not the reverse — you test membership on the character in hand. Two failure modes and you need both: wrong type on top, and empty stack (a closer with nothing open). Dropping the final `not stack` makes "((" return True.',
    },
    {
      id: 'B',
      label: 'Nested context — park and resume',
      when: 'Decode String, nested tag expansion. Anything where an inner result folds back into an outer one.',
      code: `def decodeString(s):
    stack = []                # parked (outer_string, outer_count) pairs
    curr, num = "", 0

    for ch in s:
        if ch == "[":
            stack.append(curr)        # park the OUTER context
            stack.append(num)
            curr, num = "", 0         # start a fresh INNER context
        elif ch == "]":
            count = stack.pop()       # pushed LAST  -> pops FIRST
            prev  = stack.pop()
            curr  = prev + count * curr
        elif ch.isdigit():
            num = num * 10 + int(ch)  # multi-digit: 1, 10, 100
        else:
            curr += ch

    return curr`,
      note: 'Model: the stack holds what you were doing before you got interrupted. "[" parks it, "]" resumes and merges. Pops MIRROR pushes — push A then B means pop B then A. Write the "]" branch immediately after the "[" branch so a swap is visible while you type.',
    },
    {
      id: 'C',
      label: 'Monotonic stack — one answer per element',
      when: 'Next Greater Element, Daily Temperatures, Buildings With an Ocean View.',
      code: `def next_greater(nums):
    n = len(nums)
    result = [-1] * n        # default: never found one
    stack = []               # INDEXES still waiting for an answer

    for i in range(n):
        while stack and nums[i] > nums[stack[-1]]:
            j = stack.pop()
            result[j] = nums[i]      # or  i - j  for a DISTANCE
        stack.append(i)

    return result

# next SMALLER: flip one character  ->  nums[i] < nums[stack[-1]]`,
      note: 'Store indexes, never values — you need them to write into result and to measure distance. Invariant: stacked values are monotonically decreasing, which is exactly why something not bigger than the top cannot be bigger than anything below it. Whatever remains on the stack never found an answer, hence the -1 pre-fill. Swap `nums[i]` for `i - j` and this becomes Daily Temperatures.',
    },
    {
      id: 'D',
      label: 'Monotonic + width — both boundaries at once',
      when: 'Largest Rectangle, Maximal Rectangle, Trapping Rain Water. THE hard-tier template.',
      code: `def largestRectangleArea(heights):
    stack = [-1]              # sentinel: the left wall
    best = 0

    for i, h in enumerate(heights + [0]):     # sentinel: the right wall
        # h is the first bar SHORTER than everything popped here
        while stack[-1] != -1 and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            width  = i - stack[-1] - 1        # exclusive on both sides
            best = max(best, height * width)
        stack.append(i)

    return best`,
      note: 'The two sentinels remove every special case. `-1` on the stack means "nothing shorter to the left", so the width formula works at the left edge; the appended `0` is shorter than everything, so the last iteration drains the stack and no cleanup loop is needed. Width is `i - stack[-1] - 1` because BOTH boundaries are exclusive. See the derivation below — do not memorise this.',
    },
    {
      id: 'E',
      label: 'Sentinel index as a base marker',
      when: 'Longest Valid Parentheses. The stack bottom is a position, not a symbol.',
      code: `def longestValidParentheses(s):
    stack = [-1]              # base of the current valid run
    best = 0

    for i, ch in enumerate(s):
        if ch == '(':
            stack.append(i)
        else:
            stack.pop()               # pop FIRST, ask after
            if not stack:
                stack.append(i)       # unmatched ')' -> new base here
            else:
                best = max(best, i - stack[-1])

    return best`,
      note: 'Length = current index minus the last unmatched opener, so the stack must hold indexes. Seeding with -1 makes the whole-string case work arithmetically: 5 - (-1) = 6. Popping before checking is what collapses both branches into one clean shape.',
    },
    {
      id: 'F',
      label: 'Expression evaluation',
      when: 'Basic Calculator I & II, Evaluate Reverse Polish Notation.',
      code: `# F1 - RPN: operands on the stack, an operator pops two
def evalRPN(tokens):
    stack = []
    for t in tokens:
        if t in ("+", "-", "*", "/"):
            b, a = stack.pop(), stack.pop()       # b is the RIGHT operand
            stack.append(a + b if t == "+" else a - b if t == "-"
                         else a * b if t == "*" else int(a / b))
        else:
            stack.append(int(t))
    return stack[0]


# F2 - infix with precedence, no parens: defer + and -, apply * and / now
def calculate(s):
    stack, num, op = [], 0, '+'
    for i, ch in enumerate(s):
        if ch.isdigit():
            num = num * 10 + int(ch)
        if (not ch.isdigit() and ch != ' ') or i == len(s) - 1:
            if   op == '+': stack.append(num)
            elif op == '-': stack.append(-num)
            elif op == '*': stack.append(stack.pop() * num)
            else:           stack.append(int(stack.pop() / num))
            op, num = ch, 0
    return sum(stack)`,
      note: 'F2 is the whole precedence trick: push + and - as signed values to settle later, resolve * and / against the top immediately, and the final `sum` applies the deferred additions. Two traps — `b, a = pop(), pop()` order on subtraction and division, and `int(a / b)` rather than `a // b`, because Python floors toward negative infinity (-7 // 2 is -4, but these problems want -3).',
    },
    {
      id: 'G',
      label: 'Stack of tuples — carry an answer per level',
      when: 'Min Stack, Max Stack, any "O(1) aggregate alongside push/pop".',
      code: `class MinStack:
    def __init__(self):
        self.stack = []                     # (value, min_at_or_below)

    def push(self, v):
        low = v if not self.stack else min(v, self.stack[-1][1])
        self.stack.append((v, low))

    def pop(self):    self.stack.pop()
    def top(self):    return self.stack[-1][0]
    def getMin(self): return self.stack[-1][1]`,
      note: 'Say this aloud: each entry stores the answer for the stack as it existed when that entry was pushed. Popping therefore restores the previous answer for free — no recomputation, no second scan. The same idea powers Basic Calculator I, where you push (result_so_far, sign) before descending into a paren.',
    },
    {
      id: 'H',
      label: 'Mutual destruction',
      when: 'Asteroid Collision, Remove All Adjacent Duplicates, Backspace String Compare.',
      code: `def asteroidCollision(asteroids):
    stack = []
    for a in asteroids:
        alive = True
        # a collision happens only when a moves left and the top moves right
        while alive and a < 0 and stack and stack[-1] > 0:
            if stack[-1] < -a:
                stack.pop(); continue      # top dies, keep fighting
            if stack[-1] == -a:
                stack.pop()                # both die
            alive = False                  # a dies (or tied)
        if alive:
            stack.append(a)
    return stack`,
      note: 'Three outcomes per collision — incoming wins, both die, incoming dies — so you need the explicit `alive` flag; a plain while loop cannot express "stop pushing this element". The guard `a < 0 and stack[-1] > 0` encodes the only geometry where a collision can occur. Get that condition right and the rest is bookkeeping.',
    },
  ],

  walkthrough: {
    title: 'Largest Rectangle in Histogram, derived from scratch',
    steps: [
      {
        label: '1 · Reframe: iterate over heights, not over rectangles',
        body: 'There are O(n²) candidate rectangles, so enumerating them is hopeless. But every maximal rectangle has its height set by its SHORTEST bar. So flip the question — for each bar i, what is the widest rectangle whose height is exactly heights[i]? Take the max over all i. You have turned one 2-D search into n independent 1-D questions. This reframe IS the problem; everything after it is mechanical.',
      },
      {
        label: '2 · Name the boundaries',
        body: 'Bar i extends left until it meets a bar SHORTER than it, and right until the same. So the rectangle spans from prev_smaller[i] + 1 to next_smaller[i] - 1. Both boundaries are exclusive, which is why width is next_smaller[i] - prev_smaller[i] - 1. Use -1 and n when no such bar exists and the formula keeps working at the edges with no special case.',
        code: `# heights = [2, 8, 5, 6, 2, 3]
# bar 1 (h=8): prev_smaller=0, next_smaller=2 -> width 2-0-1 = 1 -> area  8
# bar 2 (h=5): prev_smaller=0, next_smaller=4 -> width 4-0-1 = 3 -> area 15  <- best`,
      },
      {
        label: '3 · Compute both boundary arrays with template C, twice',
        body: 'You already know how to find a next-smaller element. Run it right-to-left for next_smaller, left-to-right for prev_smaller, then combine. Longer than the clever version, but you can DERIVE it under pressure from a template you already own, and it is fully correct. If you reach this point in an interview you have solved the problem — say so out loud, then offer to fuse the passes.',
        code: `def largestRectangleArea(heights):
    n = len(heights)
    if n == 0: return 0

    prev_smaller = [-1] * n
    stack = []
    for i in range(n):
        while stack and heights[stack[-1]] >= heights[i]:
            stack.pop()
        prev_smaller[i] = stack[-1] if stack else -1
        stack.append(i)

    next_smaller = [n] * n
    stack = []
    for i in range(n - 1, -1, -1):
        while stack and heights[stack[-1]] >= heights[i]:
            stack.pop()
        next_smaller[i] = stack[-1] if stack else n
        stack.append(i)

    return max(h * (next_smaller[i] - prev_smaller[i] - 1)
               for i, h in enumerate(heights))`,
      },
      {
        label: '4 · Notice the two passes are secretly one pass',
        body: 'Watch the moment you POP index j in the left-to-right pass. The current i is the first bar shorter than j — so i IS next_smaller[j]. And because the stack is increasing, whatever sits beneath j is the first shorter bar to its left — that is prev_smaller[j]. Both boundaries are available at the instant of the pop. So compute the area right there and throw the arrays away.',
        code: `while stack[-1] != -1 and heights[stack[-1]] >= h:
    height = heights[stack.pop()]
    width  = i - stack[-1] - 1     # i = right bound, stack[-1] = left bound
    best   = max(best, height * width)`,
      },
      {
        label: '5 · Add sentinels to kill the edge cases',
        body: 'Two annoyances remain: bars with nothing shorter to their left, and bars still on the stack when the loop ends. Seed the stack with -1 so the width formula holds at the left edge, and append a 0 bar to the input so the final iteration drains everything. Both cases vanish and you have template D — one loop, no cleanup. O(n): each index is pushed once and popped at most once, so say "amortised" aloud, because the nested while looks quadratic.',
        code: `def largestRectangleArea(heights):
    stack = [-1]
    best = 0
    for i, h in enumerate(heights + [0]):
        while stack[-1] != -1 and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            width  = i - stack[-1] - 1
            best = max(best, height * width)
        stack.append(i)
    return best`,
      },
      {
        label: '6 · Cash it in — Maximal Rectangle is this in a loop',
        body: 'Given a binary matrix, walk the rows keeping a running histogram: heights[j] += 1 on a "1", reset to 0 on a "0". Run the function above once per row. Deriving Largest Rectangle earns you a second LC Hard for four extra lines, and naming that connection unprompted is a strong signal by itself.',
        code: `def maximalRectangle(matrix):
    if not matrix: return 0
    n = len(matrix[0])
    heights = [0] * n
    best = 0
    for row in matrix:
        for j in range(n):
            heights[j] = heights[j] + 1 if row[j] == '1' else 0
        best = max(best, largestRectangleArea(heights))
    return best`,
      },
    ],
  },

  complexity: {
    time: 'O(n)',
    space: 'O(n)',
    note: 'Push and pop are O(1). Each element is pushed once and popped at most once, so the inner while is amortised O(1) overall. Say "amortised" — the nested while LOOKS quadratic and interviewers listen for whether you know it is not.',
  },

  sections: [
    {
      heading: 'The sentence that unlocks every problem here',
      tone: 'good',
      points: [
        '"The stack holds work I have started but cannot finish yet, and the newest unfinished thing always resolves first."',
        'Brackets: the most recently opened must close first.',
        'Decode String: the innermost [ ] expands before the one containing it.',
        'Monotonic: an index sits on the stack precisely because it has not yet found its next greater element.',
        'Say it before writing code. It justifies the data structure, buys thinking time, and opens every problem on this page.',
      ],
    },
    {
      heading: 'Monotonic stack — the decision table',
      points: [
        'Next GREATER → keep the stack DECREASING → pop while nums[i] > nums[stack[-1]].',
        'Next SMALLER → keep the stack INCREASING → pop while nums[i] < nums[stack[-1]].',
        'The rule underneath: you pop when the incoming element IS the answer for the top. The pop condition determines the stack order, not the other way round — derive it, do not memorise it.',
        'Duplicates: non-strict (>= / <=) is right for essentially everything, including every problem listed here.',
        'Want a distance instead of a value? Write `i - j` in place of `nums[i]`. That one edit turns Next Greater Element into Daily Temperatures.',
        'Need both boundaries rather than one? That is template D — the item beneath the popped one is the other boundary, free.',
      ],
    },
    {
      heading: 'Sentinels — the trick that deletes edge cases',
      tone: 'good',
      points: [
        'Two of the hard templates (D and E) work only because of a sentinel, and it is the same idea both times.',
        'A sentinel on the STACK (-1) stands for "no boundary on this side", so the arithmetic holds at the edge with no branch.',
        'A sentinel in the INPUT (an appended 0 bar) is shorter than everything, so the last iteration drains the stack and no cleanup loop is needed.',
        'When a stack solution turns into a thicket of if-statements around the first and last element, reach for a sentinel before adding another branch.',
      ],
    },
    {
      heading: 'Bugs that cost the interview',
      tone: 'warn',
      points: [
        'Popping an empty stack. Every pop and every `stack[-1]` needs a guard. The single most common failure on this pattern.',
        'Reversed pop order in template B. Pushes and pops are mirrors — write the two branches adjacently.',
        'Dropping the final `not stack` check in template A: "((" returns True.',
        'Storing values instead of indexes in a monotonic stack, leaving no way to write the result or measure width.',
        'In template D, off-by-one on the width. It is `i - stack[-1] - 1` because both boundaries are exclusive.',
        'Using `a // b` instead of `int(a / b)` in a calculator — Python floors toward negative infinity, so -7 // 2 is -4 where the problem wants -3.',
        'Confusing stack with queue. If the FIRST thing in should come out first, you want a deque.',
      ],
    },
    {
      heading: 'Reading the error out loud',
      points: [
        '`can\'t multiply sequence by non-int of type \'str\'` → str * str, so two variables hold each other\'s values. On this pattern that means reversed pops.',
        '`pop from empty list` → a closer arrived with nothing open. A missing guard, not a logic rewrite.',
        '`IndexError` on `stack[-1]` → the same guard, missing on the peek instead of the pop.',
        'Tracing an error to its cause in seconds reads far better than the bug reads badly. Practise narrating it.',
      ],
    },
    {
      heading: 'Neighbouring patterns — do not confuse them',
      points: [
        'Sliding window → contiguous subarray with a validity constraint. Two pointers, no stack.',
        'Monotonic DEQUE → max/min INSIDE a moving window (Sliding Window Maximum). Pops from both ends.',
        'Recursion → often an implicit stack. "Do this iteratively" on a tree traversal is this pattern in disguise.',
        'Real interview reports on this pattern: "Find Most Called Function in Stack Trace" and Reconstruct Itinerary (LC 332).',
      ],
    },
  ],

  problems: [
    { name: 'Valid Parentheses', difficulty: 'Easy', twist: 'Template A verbatim. Should be automatic in under 3 minutes.' },
    { name: 'Min Stack', difficulty: 'Easy', twist: 'Template G. Each entry carries the answer for the stack beneath it.' },
    { name: 'Remove All Adjacent Duplicates', difficulty: 'Easy', twist: 'Template H, simplest form — compare against stack[-1] before pushing.' },
    { name: 'Backspace String Compare', difficulty: 'Easy', twist: 'Template H, "#" pops. The follow-up wants O(1) space, which means two pointers from the right instead.' },
    { name: 'Daily Temperatures', difficulty: 'Medium', twist: 'Template C with `i - j`. The canonical monotonic stack — know it cold.' },
    { name: 'Next Greater Element II', difficulty: 'Medium', twist: 'Circular. Loop 2n times with `i % n`, and only push while `i < n`.' },
    { name: 'Decode String', difficulty: 'Medium', twist: 'Template B. Two values parked per level, plus the multi-digit accumulator.' },
    { name: 'Asteroid Collision', difficulty: 'Medium', twist: 'Template H in full. The `alive` flag is the part people miss.' },
    { name: 'Buildings With an Ocean View', difficulty: 'Medium', twist: 'Template C scanned right-to-left. Traversal direction is a free parameter.' },
    { name: 'Evaluate Reverse Polish Notation', difficulty: 'Medium', twist: 'Template F1. Operand order on `-` and `/`, plus `int(a/b)` truncation.' },
    { name: 'Basic Calculator II', difficulty: 'Medium', twist: 'Template F2. Defer + and -, apply * and / immediately.' },
    { name: 'Simplify Path', difficulty: 'Medium', twist: 'Split on "/", ".." pops, "." and "" skip. Easy to under-rate, easy to fumble.' },
    { name: 'Car Fleet', difficulty: 'Medium', twist: 'Sort by position descending, then a monotonic stack on arrival times. Teaches that sorting first is often what exposes the stack.' },
    { name: 'Basic Calculator', difficulty: 'Hard', twist: 'Templates F + G: push (result, sign) at "(", restore at ")". Same park-and-resume shape as B.' },
    { name: 'Longest Valid Parentheses', difficulty: 'Hard', twist: 'Template E. The -1 sentinel is the whole trick.' },
    { name: 'Largest Rectangle in Histogram', difficulty: 'Hard', twist: 'Template D. Use the six-step derivation above — derive it, do not memorise it.' },
    { name: 'Maximal Rectangle', difficulty: 'Hard', twist: 'Largest Rectangle once per row over a running histogram. Four extra lines for a second Hard.' },
    { name: 'Trapping Rain Water', difficulty: 'Hard', twist: 'Template D shape, filling horizontal layers. Two pointers is cleaner — a good chance to compare approaches aloud.' },
    { name: 'Sliding Window Maximum', difficulty: 'Hard', twist: 'A deque, NOT this pattern. Included so you notice when the template does not apply.' },
  ],
};
