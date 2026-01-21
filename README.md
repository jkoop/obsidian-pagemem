# Pagemem

Pagemem (read "page mem") is an [Obsidian](https://obsidian.md) plugin for memorizing entire notes.

Features:
- Dead simple UI
- Only type the first letter of each word
- Leitner-style spaced repetition with configurable review intervals

## Usage

### Creating a memory note

1. Add the tag to your note: `pagemem`

That's it. Done.

### Reviewing memory notes

There are two ways of doing this:
- Open each highlighted note like you would any other note. The UI will then require you to type the first letter of each word in order (case-insensitive). E.g. [the example note](/Example%20note.md) will require you to type `MitfotmbwdoiiesarwnIitroiotftpoifaIpecnbriwbiflropitdMliudafoa`.
- Use the "Review all due memory notes" command.

Additional review commands:
- "Review memory notes in folder" to focus on a specific folder.
- "Edit memory note (skip review)" to open a memory note without starting a review.

### Spaced repetition

Pagemem uses a simple Leitner system. Each review moves the note forward a bin when you get the prompt right, or back to the first bin when you miss it. You can configure the bin intervals in **Settings → Pagemem**.

Default bin intervals (days): 1, 1, 2, 3, 5, 8, 10, 12, 15, 18, 20.

Notes store their scheduling data in frontmatter:

```yaml
pagemem:
  last-review: 2020-01-01
  next-review: 2020-01-06
  interval: 5
  bin: 4
```
