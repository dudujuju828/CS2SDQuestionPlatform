---
name: update-mcqs
description: Update an existing topic's question file — merge new questions, deduplicate, rebalance, or bulk up. Operates on questions/<slug>.json.
user_invocable: true
---

# MCQ Update Skill

This skill modifies an existing topic's question file rather than generating from scratch. It handles merging, deduplication, and re-numbering cleanly.

## 1. Determine mode and inputs

Parse the user's arguments or ask for them:

- **Topic slug** (required) — must match an existing file at `CS2SDQuestionPlatform/questions/<slug>.json`. If the file does not exist, stop and tell the user to use `/generate-mcqs` instead.
- **Mode** — one of:
  - `add` — generate new questions from a content folder and merge them into the existing file. Requires a content folder path.
  - `bulk` — generate more questions on the same topic without new content. Uses the existing questions as context so new questions cover different angles.
  - `rebalance` — audit only, no new questions generated. Report issues without auto-fixing.
- **Content folder path** — required for `add` mode. The folder containing content files.
- **Number of new questions** — how many to generate. Default 5. Not applicable in `rebalance` mode.
- **Difficulty level** — `beginner`, `intermediate`, or `advanced`. Defaults to whatever the existing file uses.

If the user provides arguments without explicitly naming a mode, infer:
- If a content folder is provided → `add` mode
- If just a slug is provided with a count → `bulk` mode
- If the user says "rebalance", "audit", or "check" → `rebalance` mode

## 2. Load the existing question file

- Read `CS2SDQuestionPlatform/questions/<slug>.json`.
- Parse it and validate it matches the expected schema (topic, difficulty, questions array).
- Record the starting count: how many questions exist before any changes.
- Record the existing answer distribution (count of A, B, C, D as correct answers).
- Report: "Loaded <slug>.json — <N> existing questions, difficulty: <level>"

## 3. Generate new questions (skip for `rebalance` mode)

### For `add` mode:

- Read content files from the specified folder using the same extraction methods described in the `generate-mcqs` skill:
  - `.pptx` files: extract text from `ppt/slides/slide*.xml` by reading `<a:t>` tags from the zip archive using Python.
  - `.epub` files: extract text from HTML/XHTML files inside the zip archive using Python.
  - `.pdf` files: extract text using available tools.
  - `.md` / `.txt` files: read directly.
- Skip files that yield no meaningful text content.

### For `bulk` mode:

- Do not read external content files.
- Instead, use the existing questions as context. Provide the existing stems to the generation prompt so it knows what's already covered.

### Generation prompt

Use the **exact same generation prompt and anti-tell rules** defined in the `generate-mcqs` skill (Section 3: "Generate questions"). Do not duplicate or rewrite that prompt — reference the same instructions. The prompt starts with "You are an expert assessment designer..." and includes all subsections: Option Construction, Language & Tone, Answer Positioning, Stem Design, Self-Check, and Output Format.

Additionally, prepend the following context to the prompt:

> The following questions already exist for this topic. Generate new questions that test **different scenarios, concepts, or angles** from the ones below. Do not repeat or rephrase existing stems.
>
> Existing stems:
> - [list each existing question's stem]

For `bulk` mode, also add:

> Use the topic name and difficulty level from the existing file. Infer the subject domain from the existing questions and generate new questions that expand coverage.

The output format for new questions should be a JSON array of question objects only (not the full file wrapper), since they will be merged into the existing file.

## 4. Deduplicate

Compare each newly generated question against all existing questions:

1. **Stem similarity check** — for each new question's stem, compare against every existing stem. A new question is a duplicate if:
   - It tests the same specific concept using the same type of scenario (e.g., both ask about polymorphism via method overriding in a payment system)
   - The core reasoning required to answer is identical, even if surface wording differs
   - It asks the same question with trivially different variable names or domain nouns

2. **Decision**: if a new question is semantically too similar to an existing one, **discard it** and record:
   - The discarded stem (truncated to ~80 chars)
   - Which existing question it duplicated (by ID)

3. Keep questions that test the same broad concept but from a genuinely different angle, scenario type, or reasoning path.

Report: "<M> new questions generated, <D> discarded as duplicates, <K> surviving"

## 5. Merge and re-number

- Append the surviving new questions to the end of the existing questions array.
- Re-number **all** question IDs sequentially: `q1`, `q2`, `q3`, ... `qN` — no gaps, no duplicates, ordered by array position.
- Preserve the existing file's `topic` and `difficulty` fields unchanged.

## 6. Validate answer distribution

Count the correct answer distribution (A, B, C, D) across the **entire merged set** (not just the new batch).

- Calculate the expected count per position: `total / 4`.
- If any position deviates by more than 25% from the expected count (e.g., 8 questions should have ~2 per position; if one has 0 or 4+, that's skewed), **flag it** in the report.
- **Do not silently change answers.** Only report the imbalance so the user can decide.

Report format:
```
Answer distribution (merged set of <N> questions):
  A: <count> (<percent>%)
  B: <count> (<percent>%)
  C: <count> (<percent>%)
  D: <count> (<percent>%)
  Status: balanced | ⚠ skewed — <position(s)> overrepresented
```

## 7. Write the updated file

- Write the merged JSON back to `CS2SDQuestionPlatform/questions/<slug>.json`.
- Validate the JSON is parseable before writing (parse it back after serialization).
- Use 2-space indentation, no trailing commas.

## 8. Rebalance mode (audit only)

If the mode is `rebalance`, skip steps 3–5 and 7. Instead, perform and report:

### Answer position distribution
Same check as step 6 — count A/B/C/D distribution and flag imbalances.

### Option length consistency
For each question, calculate the word count of each option (A–D). Flag any question where the longest option exceeds the shortest by more than 20%.

Format: `q<ID>: option lengths A=<n>, B=<n>, C=<n>, D=<n> — <OK | ⚠ uneven>`

### Anti-tell rule compliance
For each question, check:
- **Hedge word concentration**: do words like "primarily", "in most cases", "often", "generally", "typically" appear only in the correct answer? Flag if so.
- **Absolute concentration**: do words like "always", "never", "only", "all", "none" appear only in distractors? Flag if so.
- **Keyword echo**: does the correct answer repeat distinctive (non-common) words from the stem more than the distractors do? Flag if so.

Format per flagged question: `q<ID>: <rule violated> — <brief explanation>`

### Summary
```
Audit of <slug>.json — <N> questions
  Answer distribution: <balanced | ⚠ skewed>
  Option length issues: <count> questions flagged
  Anti-tell violations: <count> questions flagged
  Overall: <clean | <count> issues found>
```

Do not modify the file in rebalance mode. Report only.

## 9. Final report

Summarize the operation:

```
Update complete: <slug>.json
  Before: <N> questions
  Generated: <M> new
  Duplicates discarded: <D>
  After: <T> questions
  Answer distribution: <balanced | ⚠ skewed>
  File written: questions/<slug>.json
```

## 10. Verify

After writing the updated file, run `cd CS2SDQuestionPlatform && npm run build` to confirm the site still builds cleanly.

## 11. Commit discipline

Make regular, granular commits throughout the process. Each logical step should be its own commit:
- Loading and reading the existing file (if any preparatory changes are needed)
- Writing the updated/merged question file
- Any follow-up fixes (e.g., JSON validation corrections)

Do not batch everything into one commit. Use clear, descriptive commit messages.
