import type { PatternSheet } from '../types';

export const stack: PatternSheet = {
  slug: 'stack',
  title: 'Stack & Monotonic Stack',
  kind: 'pattern',
  source: 'Hello Interview — Coding Patterns',
  sourceUrl: 'https://www.hellointerview.com/learn/code/stack/overview',
  tags: ['stack', 'monotonic-stack', 'strings', 'arrays', 'parsing'],
  updated: '2026-08-22',

  triggers: [
    'NESTED structure — brackets, tags, encoded strings. The innermost thing must resolve first, which is literally LIFO.',
    '"Matching", "balanced", "well-formed", "valid" over paired symbols.',
    '"Next greater" / "next smaller" / "first taller to the right" → monotonic stack.',
    '"How many days until…" / "how far until a bigger value" → monotonic stack, store INDEXES not values.',
    'Histogram, skyline, rectangle, trapped water — 2-D shapes built from bar heights.',
    'Brute force is O(n²) with a nested "scan rightward until I find something bigger" loop. That inner loop is the thing a monotonic stack deletes.',
  ],

  template: [
    {
      label: '1 · Matching pairs (Valid Parentheses)',
      code: `def isValid(s):
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}

    for char in s:
        if char in mapping:                                  # a CLOSER
            if not stack or stack[-1] != mapping[char]:
                return False
            stack.pop()
        else:                                                # an OPENER
            stack.append(char)

    return len(stack) == 0        # leftovers = unclosed openers`,
      note: 'Map closer→opener, not the reverse: you test membership on the character you are holding. Two failure points, and you need both — wrong type on top, AND empty stack (a closer with nothing open). Returning True without the final emptiness check passes "((" .',
    },
    {
      label: '2 · Nested context (Decode String)',
      code: `def decodeString(s):
    stack = []
    curr_string = ""
    curr_num = 0

    for char in s:
        if char == "[":
            stack.append(curr_string)      # park the OUTER context
            stack.append(curr_num)
            curr_string, curr_num = "", 0  # fresh inner context
        elif char == "]":
            num = stack.pop()              # pushed LAST → pops FIRST
            prev_string = stack.pop()
            curr_string = prev_string + num * curr_string
        elif char.isdigit():
            curr_num = curr_num * 10 + int(char)   # multi-digit build
        else:
            curr_string += char

    return curr_string`,
      note: 'Mental model: the stack holds what you were working on before you got interrupted. "[" parks it, "]" resumes and merges. Pops MIRROR pushes — push A then B means pop B then A; swapping those two lines is the single most common bug here. The digit line handles "100[x]": each new digit shifts the running value one decimal place left.',
    },
    {
      label: '3 · Monotonic stack (next greater element)',
      code: `def nextGreaterElement(nums):
    n = len(nums)
    result = [-1] * n          # default: nothing greater to the right
    stack = []                 # holds INDEXES still awaiting an answer

    for i in range(n):
        while stack and nums[i] > nums[stack[-1]]:
            idx = stack.pop()
            result[idx] = nums[i]
        stack.append(i)

    return result

# next SMALLER element: flip one character  →  nums[i] < nums[stack[-1]]`,
      note: 'Store indexes, not values — you need them to write into result, and to compute distances. Invariant: values at the stacked indexes are monotonically DECREASING, which is exactly why a new element that is not bigger than the top cannot be bigger than anything beneath it. Anything left on the stack at the end never found an answer, which is why result is pre-filled with -1.',
    },
    {
      label: '4 · Largest Rectangle in Histogram (hard)',
      code: `def largest_rectangle_area(heights):
    stack = []          # indexes, monotonically INCREASING in height
    max_area = 0
    i = 0

    while i < len(heights):
        if not stack or heights[i] >= heights[stack[-1]]:
            stack.append(i)
            i += 1                      # only advance when we push
        else:
            top = stack.pop()
            right = i - 1               # i is the first shorter bar right
            left = stack[-1] if stack else -1
            max_area = max(max_area, heights[top] * (right - left))
            # note: i does NOT advance — it may bound the new top too

    while stack:                        # bars that never met a shorter bar
        top = stack.pop()
        width = i - stack[-1] - 1 if stack else i
        max_area = max(max_area, heights[top] * width)

    return max_area`,
      note: 'The reframe that unlocks it: for each bar, the biggest rectangle whose HEIGHT is that bar spans from the first shorter bar on its left to the first shorter bar on its right. That is two monotonic-stack queries at once — i supplies the right boundary, the element beneath top supplies the left. The two traps: do NOT increment i on the pop branch (one i can close several bars), and do not forget the drain loop.',
    },
    {
      label: '5 · Sentinel index (Longest Valid Parentheses, hard)',
      code: `def longest_valid_parentheses(s):
    max_len = 0
    stack = [-1]              # sentinel: "start of the current valid run"

    for i, char in enumerate(s):
        if char == '(':
            stack.append(i)
        else:
            stack.pop()
            if not stack:
                stack.append(i)      # unmatched ')' → new run starts here
            else:
                max_len = max(max_len, i - stack[-1])

    return max_len`,
      note: 'Here the stack holds INDEXES and the bottom is a base marker, not a bracket. Length is current index minus the last unmatched opener. Seeding with -1 makes the whole-string case work arithmetically: 5 - (-1) = 6. When a ")" empties the stack it was unmatched, so it becomes the new base. Pop first, ask questions after — that ordering is what makes both branches fall out.',
    },
  ],

  complexity: {
    time: 'O(n)',
    space: 'O(n)',
    note: 'Push and pop are O(1). Each element is pushed once and popped at most once, so the inner while loop is amortised O(1) — say "amortised", because the nested while makes it LOOK quadratic and interviewers listen for whether you know it is not.',
  },

  sections: [
    {
      heading: 'The one sentence that unlocks the whole pattern',
      tone: 'good',
      points: [
        '"The stack holds work I have started but cannot finish yet, and the newest unfinished thing is always the one that resolves first."',
        'Parentheses: the most recently opened bracket must close first.',
        'Decode String: the innermost [ ] must expand before the one containing it.',
        'Monotonic: an element sits on the stack precisely because it has not yet found its next greater element.',
        'Say this out loud before coding. It justifies the data structure and buys thinking time — the same opener works for every problem on this list.',
      ],
    },
    {
      heading: 'Monotonic stack — the decision table',
      points: [
        'Next GREATER element → keep the stack DECREASING → pop while nums[i] > nums[stack[-1]].',
        'Next SMALLER element → keep the stack INCREASING → pop while nums[i] < nums[stack[-1]].',
        'The rule: you pop when the incoming element is the answer for the top. The direction you pop in determines the stack\'s order, not the other way round.',
        'Duplicates: non-strict (>= or <=) is right for almost everything, including all the problems here. Only go strict if the problem forbids equal neighbours.',
        'Want distance rather than value? Store indexes and write `i - idx` instead of `nums[i]`. That single change turns Next Greater Element into Daily Temperatures.',
      ],
    },
    {
      heading: 'Bugs that cost the interview',
      tone: 'warn',
      points: [
        'Popping an empty stack. Every pop needs `if stack` or `while stack` in front of it. This is the #1 listed mistake.',
        'Reversed pop order in the nested-context template. Pushes and pops are mirrors — write the "]" branch immediately after the "[" branch so the asymmetry is visible while typing.',
        'Forgetting the final emptiness check in Valid Parentheses — "((" returns True without it.',
        'Storing values instead of indexes in a monotonic stack, then having no way to write the result or measure a distance.',
        'Incrementing i on the pop branch of Largest Rectangle. One bar can be the right boundary for several stacked bars.',
        'Forgetting the drain loop after the main loop — the tallest bars never meet a shorter bar and would score zero.',
        'Confusing stack with queue. If the FIRST thing in should come out first, you want a deque, not this pattern.',
      ],
    },
    {
      heading: 'How to read an error here, out loud',
      points: [
        'Python tells you a lot. `can\'t multiply sequence by non-int of type \'str\'` means str * str — so one variable is holding the other\'s value, which on this pattern means reversed pops.',
        '`pop from empty list` means a closer arrived with nothing open — a missing guard, not a logic rewrite.',
        '`IndexError` on `stack[-1]` is the same guard, missing on the peek instead of the pop.',
        'Tracing an error to its cause in seconds reads far better than the bug reads badly. Practise narrating it.',
      ],
    },
    {
      heading: 'Neighbouring patterns — do not confuse them',
      points: [
        'Sliding window → contiguous subarray with a validity constraint. Two pointers, no stack.',
        'Monotonic DEQUE → you need the max/min INSIDE a moving window (Sliding Window Maximum). Pops from both ends.',
        'Recursion → often equivalent to an explicit stack; if an interviewer asks for an iterative tree traversal, that is this pattern wearing a different hat.',
        'Real interview reports for this pattern: "Find Most Called Function in Stack Trace" and Reconstruct Itinerary (LC 332).',
      ],
    },
  ],

  problems: [
    { name: 'Valid Parentheses', difficulty: 'Easy', twist: 'The base case. Template 1 verbatim. Should be automatic in under 3 minutes.' },
    { name: 'Min Stack', difficulty: 'Easy', twist: 'Push (value, min_so_far) pairs, or keep a second stack. Teaches that a stack entry can be a tuple of context.' },
    { name: 'Baseball Game / Remove All Adjacent Duplicates', difficulty: 'Easy', twist: 'Warm-ups for "compare against stack[-1] before pushing" — the seed of the monotonic idea.' },
    { name: 'Daily Temperatures', difficulty: 'Medium', twist: 'Template 3 with `i - idx` instead of `nums[i]`. The canonical monotonic stack — know this one cold.' },
    { name: 'Next Greater Element II', difficulty: 'Medium', twist: 'Circular array. Loop `2n` times using `i % n` and only push during the first pass.' },
    { name: 'Decode String', difficulty: 'Medium', twist: 'Template 2. Two things stacked per level, plus the multi-digit accumulator.' },
    { name: 'Buildings With an Ocean View', difficulty: 'Medium', twist: 'Monotonic stack scanned right-to-left. Shows that direction of traversal is a free parameter.' },
    { name: 'Asteroid Collision', difficulty: 'Medium', twist: 'Pop-with-a-decision: the incoming element may destroy the top, be destroyed, or both. Careful loop-control practice.' },
    { name: 'Evaluate Reverse Polish Notation', difficulty: 'Medium', twist: 'Operand stack. Watch operand order on subtraction and division — b comes off before a.' },
    { name: 'Basic Calculator II', difficulty: 'Medium', twist: 'Same digit accumulator as Decode String; defer +/- onto the stack and apply * / immediately.' },
    { name: 'Simplify Path', difficulty: 'Medium', twist: '".." is a pop, "." and "" are skips. Stack of path segments — an easy one to under-rate.' },
    { name: 'Basic Calculator', difficulty: 'Hard', twist: 'Parentheses plus signs. Stack the running result and the sign, exactly like Decode String parks its context.' },
    { name: 'Longest Valid Parentheses', difficulty: 'Hard', twist: 'Template 5. The -1 sentinel is the whole trick; without it the arithmetic does not close.' },
    { name: 'Largest Rectangle in Histogram', difficulty: 'Hard', twist: 'Template 4. Two boundaries from one stack. The hardest on the list — and Maximal Rectangle is this run once per matrix row.' },
    { name: 'Trapping Rain Water', difficulty: 'Hard', twist: 'Solvable with a decreasing stack filling horizontal layers, though two pointers is cleaner. Good for showing you can compare two approaches.' },
  ],
};
