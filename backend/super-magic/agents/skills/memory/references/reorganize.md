# Reorganize memory without discarding useful information

The objective is an immediately useful core plus retrievable explanations and summaries of important decisions and events. A tiny MEMORY.md, a high compression ratio, or a file within budget is not evidence of successful preservation.

For Claw, apply this preservation workflow and the runtime's per-file source-text budget to its workspace MEMORY.md. Use its inherited workspace rules and existing memory layout for destinations instead of imposing the ordinary-project notes tree or creating a project-memory copy. Save and check destinations before shortening the source, and retain exact retrieval paths and reading conditions.

## Work in bounded sections

1. Use the actual paths, scopes, and per-file budgets supplied by the runtime. Inspect the source structure and relevant existing notes. Read the relevant content before choosing destinations; do not classify or move it solely by filenames or headings. Read large sources in manageable sections; track which sections are read and processed in the current task. Do not assume the whole source fits in one model context.
2. Account for each processed section's facts, conditions, exceptions, important values, decisions, reasons, source boundaries, and historical relations. Follow the main skill to distinguish user statements, specific choices, tentative views, and status, preserving their subjects, situations, and known times; do not distill them into rules the user never expressed. Identify user background, frequently used information, cross-project facts, and the ongoing work, meaningful changes, and last recorded progress represented across relevant topics for MEMORY.md, fuller reference explanations, useful summaries of past decisions and events, duplicate wording, and information with a clear reason to delete.
3. Check existing project files before duplicating information. When a reliable, future-accessible source already preserves the details, memory can retain the facts and rules needed in routine work and a precise retrieval pointer for other details. Individual business records belong in project files; keep their key findings and exact path, and apply the destination check below before removing any only copy. Preserve useful conversational details that source does not capture. A matching keyword or a temporary local path does not establish preservation.
4. Choose destinations using the main skill's directory roles and paths, correcting misplaced existing notes within the affected scope. Merge reusable explanations and summaries into existing relevant references or dated records before creating a new note. Keep details normally used together in one subject note, with conclusions, conditions, reasons, and sources beside each other. Preserve each origin's project/topic identity and source time under the main skill's attribution rules; organizing today does not replace them with this task's identity or time. Each reference should answer current content-based questions; each event record should answer ordinary questions about that time. Add events only for independent historical value, using useful short overlap and cross-links instead of full copies or bare-link-only records. Apply this same workflow to global memory. Brand or domain context and experiences useful across projects may remain global; handle project-specific content according to its known ownership and the permitted scope. If the target project is outside that scope or its path cannot be established, preserve the original sources and known information and report the specific unresolved item; do not guess a destination or delete the original first.
5. Save destinations and read them back before shortening the corresponding source section. Check that meaningful conditions, exceptions, values, and reasons remain recoverable and that links lead to the actual content. Existing project sources count as destinations only when they are verified to contain the information and remain accessible.
6. Shorten only processed source content with a confirmed destination or an explicit deletion basis. Keep frequently used rules and details, current preferences and constraints, and relevant recent decisions and project progress directly usable in MEMORY.md; a saved destination does not by itself justify removing them. Add specific reading triggers for details kept in notes. Never overwrite an entire source while it still contains unread or unprocessed sections.
7. Update existing indexes and ancestor pointers only when their summary or route changed. Create an index only when direct entries are dense, not for every new file or date. Use the directory growth guidance and examples below when a dense index, a large mixed note, or extensive history needs further subdivision. Do not rewrite the whole tree for one new entry.

Detailed information no longer needed in routine work may move from automatic to deferred loading. Still-applicable user preferences and requirements remain in MEMORY.md. Age, infrequent use, or irrelevance to the present task is not a reason to erase useful knowledge. Without actual access records, do not invent recency scores or last-access times. Merge redundant wording while retaining distinct qualifications. Preserve meaningful superseded decisions with their dates and successor links; do not rewrite history to make a later decision appear earlier.

Do not move all detail into another oversized, unorganized file, count a permanent backup as usable archiving, or create an extra manifest/transaction system. Maintain normal files and actionable indexes. An explicit forget request requires removing the affected information from all relevant permitted views, including history.

## Directory growth and examples

The shared directory tree, file responsibilities, note format, attribution, absolute user-file links, and date rules are in the preloaded main skill. The examples below illustrate when to keep a small core, move related detail together, add an independent event, or split an affected index. Replace source and path placeholders with verified values; they do not define mandatory categories or additional files.

### Start small, expand when useful

```text
<allowed memory scope>/
└── MEMORY.md
```

For example, a user confirms that accommodation should be quiet and convenient for the venue, with cancellable bookings when the itinerary is uncertain. A few useful sentences belong directly in MEMORY.md, together with their source. They do not require a separate note.

Later, several conversations add city-specific choices, exceptional itineraries, transport considerations, and reasons. Keep the choices, transport considerations, and reasons used for regular travel in MEMORY.md, even when they take several paragraphs. Fuller explanations of occasional booking exceptions can go directly into a subject note or move there when no longer routinely needed:

```text
<allowed memory scope>/
├── MEMORY.md
└── notes/
    └── references/
        └── travel-arrangements.md   # The detailed content of this subject
```

```markdown
## Travel arrangements
Prefer quiet accommodation convenient for the venue.
While the itinerary may change, prefer a cancellable booking even at a higher price; judge the acceptable difference against the confirmed trip budget.
This reduces cancellation losses when plans change. Source: the user's explicit trade-off in <travel-planning topic name> (ID: <real topic ID>), <known source date and timezone>.
When a booking involves an exception to cancellation terms or a disputed fee, read [travel arrangements](<absolute user-memory path to notes/references/travel-arrangements.md>) for applicable conditions, comparison steps, and lessons from previous decisions.
```

Routine accommodation choices can use the preferences, conditions, and reasons directly from MEMORY.md. The note contains reusable explanations and procedures for occasional cases. Booking records and past itineraries stay in project files. Keep confirmed requirements for an ongoing itinerary in MEMORY.md while they affect upcoming work. Do not create this structure merely to store a few example sentences. File names come from actual content and use the user's language; the example is not a system file, tool, or mandatory category. The path is the identifier; do not invent additional IDs.

### Keep subject and event records useful

A section within a longer subject note can read as follows. This small excerpt alone would not justify a separate file:

```markdown
## Checking a disputed cancellation fee
Check the hotel's cancellation deadline and the platform's service-fee policy separately; free hotel cancellation does not necessarily waive the platform fee.
Compare those terms with the cancellation confirmation.
Source: the user's confirmed explanation of a previous fee dispute in <topic name> (ID: <real topic ID>), <known source date and timezone>.
```

Keep useful provenance beside the relevant information, as a brief sentence or note. Do not make the reader open a separate source file or reconstruct attribution from a distant file-wide source section. Do not invent a conversation, link, or date when the source is unknown. New notes use the frontmatter in the preloaded main skill; topic attribution needs no additional fields.

Add an event only when it has independent value, such as explaining why a particular itinerary changed. Use its actual source date at notes/timeline/YYYY/MM/YYYY-MM-DD.md; a section could read:

```markdown
## Accommodation choice for this itinerary
The itinerary was not final, so a cancellable booking was selected at the price difference confirmed for this trip.
Source: the user's confirmation in <itinerary topic name> (ID: <real topic ID>), <known source date and timezone>. This particular choice does not establish a rule for every future trip.
General preferences: [travel arrangements](<absolute user-memory path to notes/references/travel-arrangements.md>).
```

A reference should normally answer current subject questions on its own; an event should answer common questions about that time on its own. A short repeated conclusion and reason can make both useful. Cross-link for additional detail, not every sentence. For example, the subject note links to the absolute path of notes/timeline/YYYY/MM/YYYY-MM-DD.md under its runtime scope, while that daily note links back to the reference's absolute path. Replace date placeholders with verified source dates.

If an existing project specification owns the details, keep the facts and rules needed in routine work and a pointer for other details, plus valuable conversational information absent from that source. A link cannot replace chat-only reasons that need preservation. Do not maintain a third copy of the specification.

### Keep topic attribution lightweight

References and timeline entries use brief source notes under the main skill's scope rules. Ordinary project passages require their source topic; project-related global passages also require the source project. For example, a shared project reference could contain:

```markdown
## Report delivery

Channel A uses CSV with amounts rounded to two decimal places. (Topic: Channel A integration, ID: <topic-a-id>.)

Channel B uses XLSX with a worksheet per store. (Topic: Channel B reporting, ID: <topic-b-id>.)
```

A timeline entry can use the same brief note after an event. These are examples, not a required format: adjacent facts from the same source and event may share one note. Keep known times and names; explicitly identify missing attribution instead of inventing it or dropping supplied IDs. Project memory need not repeat its project ID. Preserve the different channel requirements; a later discussion of Channel B does not override Channel A's valid rule.

Only create notes/topics/<topic_id>.md when the conversation's lasting background, alternatives, and decisions justify retrieval by that topic. Keep its real ID in the path and its name in the title. An existing useful reference or event usually needs attribution in place, not another copy. Preserve relevant attribution when merging or moving content, and include topic notes when applying an explicit forget request.

### Grow indexes and update links

Each entry includes a reading condition, available information, and the exact absolute user-memory target. For example:

```markdown
| When to read | What it contains | File |
|---|---|---|
| Handling an exception to cancellation terms or a disputed booking fee | Applicable conditions, comparison steps, lessons from previous decisions, and sources | [Travel arrangements](<absolute user-memory path to notes/references/travel-arrangements.md>) |
```

Keep each existing parent focused on immediate children and useful summaries. Few direct pointers can stay in MEMORY.md without another index. A timeline month index includes source dates, event summaries, reading triggers, and paths; it should answer a broad question about that month without opening every day. Create year/month/category directories and indexes only as useful content requires them.

When an index exceeds its applicable budget or entries mix several independently useful subjects, split only that part and replace its parent entries with an accurate route. Use content categories for references and year/month/day for timeline. Do not move a useful rule out of the core just to make an index smaller.

Split a note when its subsubjects are independently useful, targeted reading has become difficult, and separation will reduce irrelevant reading. Keep material normally needed together in one file; prefer headings and range reads before permanent fragmentation. Read known targets directly and batch independent known files with read_files when useful. A batch request does not prove full reading: respect actual ranges and truncation markers.

For an oversized daily note containing independent events, keep YYYY-MM-DD.md as the day overview and move event details into the sibling YYYY-MM-DD/ directory. Split by event meaning, not bytes, a fixed number of lines, or midnight within one continuous event. Very tight context on a single read is normally handled by reading ranges, not permanently splitting the file.

Save and check destinations first. Then update known old-path links, direct parent entries, and ancestors whose route or meaning changed before removing the old entry. Only expand the affected branch; do not reorganize unrelated history. Read historical relative links from their known containing file; generate absolute user-memory links for the changed routes. Project-document links must identify the source project/workspace base and be accessible to future relevant Agents.

## Finish from available results or address a specific gap

Use before/after token counts from normal writing-tool results. Consider the task's initial total, the last result, the runtime budget, and the available source together; the last small edit alone may hide a large cumulative reduction. An intentionally incomplete draft is not a completed reorganization. If the intended content is saved in the appropriate files and no specific omission, failure, or conflict remains, finish without an extra review phase, reread, or counting call.

If the available results reveal an unexpectedly sparse result relative to the source's useful content, use still-available source and targeted destination reads to identify concrete omissions. This includes missing recent work context or known topic sources, frequently needed rules or details left only in notes and reading conditions that do not identify when those notes are relevant. Make at most one focused supplementation pass across the affected core, notes, and pointers; no omission means zero passes. Prefer precise or batched edits to regenerating everything. This allowance belongs to the whole reorganization, not to each file or each tool call. It is not a fixed limit on the tool calls needed to safely process the original task.

After that pass, stop length-driven revision and report remaining gaps. Do not launch a reviewer Agent, infer semantic omissions from numbers alone, repeatedly request expansion, fill to a target, or perform another counting call when a valid tool result already supplies the same measurement. Use inspect_memory only for requested counts or a missing trustworthy current count that would change the next decision; batch related files. The numeric feedback is a signal for your judgment, not a semantic audit or a guarantee against loss. Preserve the save-and-read-back check before shortening the only source; ordinary successful writes do not imply a full-library reread.

## Completion and interruption

A reorganization is complete when all intended sections are handled and user background, explicit requirements, useful facts and experiences, frequently used rules and details, and relevant recent context remain directly useful in MEMORY.md. Global content retains enough detail to understand relevant user background and the circumstances of recorded facts; project content retains enough to explain ongoing work and meaningful progress with known topic sources. Do not keep only general rules inferred from specific choices while discarding the original facts, conditions, and reasons. Material kept in notes is reachable from accurate pointers that explain when to read it, the affected layout follows the main skill's directory roles and paths, current/history relationships and source times remain clear, and the affected core is at or below its maximum. A useful result above the preferred target needs no further shrinking; a genuinely small core needs no filler.

If a section is unread, a destination failed, a source is inaccessible, or another Agent changed the file, preserve the affected source. Re-read current files before merging; do not overwrite another session's edits with an old snapshot. Report partial completion, even if the core temporarily remains over budget. Runtime read truncation is not permission to delete disk content.

On cancellation, stop starting new maintenance operations and retain already completed writes. Do not claim multi-file atomicity or recovery that did not happen. The final task response may briefly describe destinations and unresolved sections; do not write operational status into the memory itself.
