---
name: generate-mcqs
description: Generate multiple-choice questions from content files. Reads content files from a specified folder and produces one JSON quiz file per content file in the questions/ directory.
user_invocable: true
---

# MCQ Generation Skill

When the user invokes this skill, follow this process:

## 1. Determine inputs

Ask the user for:
- **Content folder path** — the folder containing content files to generate questions from (e.g., `../lecture_one`). If provided as an argument, use that directly.
- **Number of questions** per file — default to 10 if not specified.
- **Difficulty level** — `beginner`, `intermediate`, or `advanced`. Default to `intermediate` if not specified.

## 2. Read the content files

- Glob all files in the specified folder (`.pptx`, `.epub`, `.pdf`, `.md`, `.txt`, or any readable format).
- For each file, extract the text content:
  - `.pptx` files: extract text from `ppt/slides/slide*.xml` by reading `<a:t>` tags from the zip archive using Python.
  - `.epub` files: extract text from HTML/XHTML files inside the zip archive using Python.
  - `.pdf` files: extract text using available tools.
  - `.md` / `.txt` files: read directly.
- Skip files that yield no meaningful text content.

## 3. Generate questions

For each content file with extractable text, generate questions using the following prompt. Replace `[NUMBER]` with the requested count and `[DIFFICULTY]` with the requested level:

---

You are an expert assessment designer. Generate [NUMBER] multiple-choice questions based on the following content at a [DIFFICULTY: beginner | intermediate | advanced] level.

Every single question must be problem-solving oriented. No question should ask the student to recall a definition or fact directly. Every stem must present a scenario, situation, code snippet, case study, debugging problem, or decision point that forces the student to think through the problem to arrive at the answer. The goal is to make the student reason, not remember.

Difficulty controls complexity: beginner means one concept in a straightforward scenario, intermediate means applying a concept in a realistic situation with some nuance, advanced means multiple interacting concepts, edge cases, or tradeoffs.

Follow these rules strictly to eliminate structural cues that could give the answer away:

### Option Construction
- All four options (A–D) must be similar in length (within ~20% word count of each other). If the correct answer is 12 words, every distractor must be 9–15 words.
- All options must use the same level of technical specificity. No mixing vague fillers with precise terminology.
- All options must be grammatically parallel — same structure, same tense, same part of speech. If one is a noun phrase, all are noun phrases.
- All options must be plausible and domain-appropriate. Each distractor should reflect a real misconception, common error, or adjacent concept — never an absurd throwaway.

### Language & Tone
- Do not use hedge words (e.g., "primarily," "in most cases," "often") exclusively in the correct answer. Either use them in all options or in none.
- Do not use absolutes (e.g., "always," "never," "only") exclusively in the distractors. Distribute qualifying language evenly.
- The correct answer must not echo or repeat distinctive keywords from the question stem more than the distractors do.

### Answer Positioning
- Distribute the correct answer roughly evenly across A, B, C, and D across the full set. Do not cluster correct answers in any one position.
- After drafting, randomise the option order within each question before presenting the final output.

### Stem Design
- The stem must be a complete, self-contained question or sentence completion that makes sense without reading the options.
- Avoid grammatical cues in the stem (e.g., "an ___") that only agree with one option. If unavoidable, ensure multiple options fit the grammar.
- Prefer stems that present: a code snippet to analyze, a scenario with a decision to make, a system with a bug to identify, a situation where the student must predict an outcome, or a tradeoff to evaluate.

### Self-Check (perform silently before outputting)
- Could a student with zero subject knowledge guess correctly based on length, tone, specificity, grammar, or position patterns? If yes, revise.
- Are at least two distractors strong enough that a partially-informed student would seriously consider them? If not, strengthen them.
- Cover the correct answer — do the distractors all still look equally plausible on their own? If one stands out as obviously wrong, replace it.

### Output Format

Return valid JSON matching this schema exactly:

```json
{
  "topic": "Derived from the content file name or title",
  "difficulty": "beginner | intermediate | advanced",
  "questions": [
    {
      "id": "q1",
      "stem": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "B",
      "rationale": "Why B is correct",
      "distractorRationale": {
        "A": "Misconception targeted",
        "C": "Misconception targeted",
        "D": "Misconception targeted"
      }
    }
  ]
}
```

Return only the JSON. No markdown, no commentary.

---

## 4. Write output files

- For each content file, derive a slug from the filename (lowercase, hyphens, no extension).
- Write the generated JSON to `CS2SDQuestionPlatform/questions/<slug>.json`.
- Validate the JSON is parseable before writing.
- Report which files were created and how many questions each contains.

## 5. Verify

After writing all files, run `cd CS2SDQuestionPlatform && npm run build` to confirm the site builds cleanly with the new question files.
