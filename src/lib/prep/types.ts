/**
 * Interview prep content.
 *
 * Content lives in the repo as typed data, not MDX or a CMS. Two reasons:
 * the app has five runtime dependencies and adding a markdown pipeline for a
 * handful of pages is a bad trade, and typed content means a half-written
 * cheat sheet fails `npm run typecheck` instead of rendering a blank section.
 *
 * Every sheet is keyed by `slug`, which is also its URL. Slugs are permanent —
 * they get bookmarked and read on a phone ten minutes before a call.
 */

export type SheetKind = 'design' | 'pattern';

export interface SheetMeta {
  slug: string;
  title: string;
  kind: SheetKind;
  /** Hello Interview section (or wherever this came from). Shown as a subtitle. */
  source?: string;
  /** Link back to the original lesson, for when the sheet isn't enough. */
  sourceUrl?: string;
  /** Free-form tags for filtering on the index: 'graphs', 'caching', 'faang'. */
  tags: string[];
  /** ISO date the sheet was last edited. Drives the "written N ago" line. */
  updated: string;
}

/** A labelled block of bullet points — the workhorse of both sheet kinds. */
export interface Section {
  heading: string;
  /** Rendered as a list. Keep each line short enough to scan, not read. */
  points: string[];
  /**
   * 'default' reads as neutral, 'warn' as a gotcha, 'good' as a thing to
   * actively say out loud in the interview. Colour is a hint only — the
   * heading always carries the meaning in words.
   */
  tone?: 'default' | 'warn' | 'good';
}

/** Question → the answer you want to have ready. Rapid-fire drilling. */
export interface QA {
  q: string;
  a: string;
}

/** System design cheat sheet. */
export interface DesignSheet extends SheetMeta {
  kind: 'design';
  /** Three lines max. The thing you'd say if given one breath to explain it. */
  gist: string[];
  /** Numbers worth memorising: latencies, throughputs, sizing rules. */
  numbers?: { label: string; value: string }[];
  sections: Section[];
  /** The tradeoffs an interviewer will probe. Both sides, then your default. */
  tradeoffs?: { axis: string; a: string; b: string; pick: string }[];
  quickfire?: QA[];
}

/**
 * A row of the routing table: what you SEE in the problem, which template it
 * maps to, and why. This is the part you read under pressure — picking the
 * right skeleton is most of the battle, and a wall of templates with no index
 * into it is not usable in an interview.
 */
export interface Route {
  /** The phrase or shape in the problem statement. */
  signal: string;
  /** Template id it routes to, e.g. 'C'. Matches the `id` on a Template. */
  use: string;
  /** One line on why that template fits — the reasoning, not just the mapping. */
  why: string;
}

/** One numbered step of a derivation, so a hard problem is reachable cold. */
export interface Step {
  label: string;
  body: string;
  code?: string;
}

/** LeetCode pattern template. */
export interface PatternSheet extends SheetMeta {
  kind: 'pattern';
  /** Phrases in a problem statement that mean "reach for this pattern". */
  triggers: string[];
  /** Signal → template routing table. Rendered before the templates. */
  routing?: Route[];
  /**
   * The skeletons, each with a short id ('A', 'B', …) that `routing` targets.
   * `when` is the one-line "use this if…" printed under the heading.
   */
  template: { id?: string; label: string; when?: string; code: string; note?: string }[];
  /** Derivation of a problem that is hard to reach without having seen it. */
  walkthrough?: { title: string; steps: Step[] };
  complexity: { time: string; space: string; note?: string };
  sections: Section[];
  /** Problems that fit, easy → hard, each with the twist it adds. */
  problems: {
    name: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    twist: string;
    url?: string;
  }[];
}

export type Sheet = DesignSheet | PatternSheet;
