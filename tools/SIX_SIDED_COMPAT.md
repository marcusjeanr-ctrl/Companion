# Mushoku compatibility in HMS 2.8.7 candidate

Install the extension ZIP in Lumiverse. The Six-Sided World card, Living World card, start handler, and Reporter preset do not need edits. HMS reads the active chat's WORLD STATE HUD and the attached lorebook; it does not have an independent authoritative world state.

## What is implemented

- Both Mushoku HUD dialects normalize date, age and birth, mana capacity and reserve, Touki, sword and magic ranks, voiceless casting, canon mode, agency, and geographic path. The Six-Sided calendar uses 12 months of 30 days. Living World's K-year/day format remains supported.
- The 22 saga entries are read from the chat's lorebook when present. The panel separates a dated canon reference from Marcus's personal arc and shows explicit event outcomes recorded in chat metadata. Dates and lorebook entries do not prove participation or an event outcome. Swipes rebuild the outcome ledger from active metadata; after editing narration, use Read again to refresh its tracker report.
- The spell catalog shows eligibility separately from learned and mastered spells. A fight menu, catalog entry, or first attempt does not grant a spell. Study percentages stay unknown until reported. Spell identity is exact after punctuation and case normalization so a learned base spell does not grant a longer named variant.
- A spell whose lorebook entry does not state a rank appears as **Rank unknown** under **All**, rather than being counted Within reach. The story decides when it can be learned.
- Narrated practice can automatically enter Studying for either Mushoku HUD format. A manual stop suppresses earlier practice until a later practice event; an explicit learned cast becomes Known. Unknown progress remains blank.
- The Atlas derives observed Six-Sided locations and rooms from recent HUD paths, including a custom estate. These nodes live in chat memory and do not modify the character card. A room change adds a sibling under the same estate.
- Yearless `Day N` Agenda deadlines are anchored to the current Mushoku calendar rather than compared with year zero. Birth is displayed only if the HUD supplies a birth year; missing data never renders as `K. null`. Mana tier descriptions come from the exact tier entry, not unrelated mana lore.
- Six-Sided has no dedicated OOC question guide entry. Panel questions use a neutral lore-based fallback; Living World's named guide remains intact. In-chat questions without a guide use `OOC:`. The model's live response still needs a Lumiverse check.
- Existing family, NPC Minds, relationship, gear, objectives, and generic RPG modules remain in place. Family entries require explicit kinship. NPC knowledge requests specify how information reached that character. NPC suggestions do not become accepted player goals. Gear reporting excludes unclaimed nearby items and NPC possessions.
- Cross-world detection tests cover Re:Zero, Overlord, Classroom of the Elite, Undertale, Dark Souls, and Skyrim. Six-Sided-specific Atlas and canon event logic is gated by its HUD and Mushoku identification.

## Verification

Run `node --check dist/backend.js`, `node --check dist/frontend.js`, and `node tools/test_six_sided_compat.cjs` from the extension folder. The fixture uses the 22 arc entries from the supplied Six-Sided card and checks two Mushoku HUD formats, calendar rollover, spell evidence, custom Atlas hierarchy, family classification, gear state, objectives, canon event serialization across swipes, and world detection regressions.

**Live Lumiverse validation is still required before calling the integration 100% compatible.** In separate chats with each Mushoku card, confirm the HUD and Atlas, learn and master a new spell across several replies, swipe an event outcome, visit a custom room, and verify that an NPC request does not create an objective. Open Re:Zero afterward and confirm its world and Atlas still load. Model-generated tracker reports can omit or misstate facts, so correct an individual tracker entry if narration contradicts it.

## 2.8.7 performance and panel audit

The local reader shares work only within a synchronous snapshot evaluation. It drops that shared work before any asynchronous boundary. Exact message text and swipe ID still guard the bounded HUD cache, including same-length edits. This avoids persistent caches of mutable tracker metadata or settings.

Separate mode sends current HUD-derived panels before waiting for the provider and updates narrative-derived panels after the report returns. Progress messages no longer require a full backend panel rebuild. The request retains the same enabled panel schemas and history-depth setting; compact JSON is requested without reducing tracked systems.

| Panel or feature | Evidence and tracking path |
| --- | --- |
| World State, Systems, vitals, abilities, rank and clock | Active reply HUD and HUD timeline |
| You, inventory and survival | HUD plus normalized `you` report saved as `survival` |
| Magic, study, learned and mastered spells | HUD rank/eligibility, lorebook catalog and active-swipe spell evidence |
| Present characters, People and Party | `characters`, `relations`, `party`; Party requires a roster |
| Family | Explicit kinship in `family`, with history and manual changes |
| Gear, holdings, money, factions and secrets | Their separate normalized arrays plus HUD and manual evidence |
| Agenda | `agenda`, anchored to the current calendar |
| Quests, Plot, Objectives and canon outcomes | `quests`, `plot`, `objectives`, `plot.canonEvents` |
| Minds, NPC agendas, knowledge and planted details | `minds`, `agendas`, `learned`, `chekhov`; existing guards and deduplication remain |
| Atlas | Lorebook graph and cached observed HUD location paths |
| Map and Buildings | `room`, `pos`, `posRoom`, per-place room history and map bank; now saved in separate mode too |
| Communications | Contacts and, when an applicable receiving device exists, inbox; no phone is invented for a fantasy setting |
| Injuries and immersive fights | Existing world-owned injury rules or normalized injury reports; fight readback only for an active fight |
| Chapters, Chronicle and songs | Existing reply processing, moments and local/manual controls; these do not require invented tracker events |

Disabled modules stay disabled; conditional panels remain conditional. Automatic tracking still depends on the model reporting narrative facts accurately. This audit verifies the code paths and deterministic fixtures, not every possible live RP event.

Run:

```sh
node --check dist/backend.js
node --check dist/frontend.js
node tools/test_six_sided_compat.cjs
node tools/test_panel_tracking.cjs
node tools/test_2_8_1_panel_parity.cjs
node tools/benchmark_panel_reads.cjs
```

To compare local versions, pass their backend paths to the benchmark. `COMPANION_CARD=/absolute/path/card.json` optionally loads a local card's full lorebook into each version. The harness uses 600 synthetic messages and prints a cold pass plus the median of ten warmed passes. It performs no provider calls.

Recorded warm medians in this workspace:

| Lorebook | 2.8.1 | 2.8.6 | 2.8.7 |
| --- | ---: | ---: | ---: |
| Supplied Six-Sided card | 57.03 ms | 66.22 ms | 43.92 ms |
| Supplied Living World card | 72.01 ms | 71.50 ms | 47.64 ms |

These results show local work reduced by roughly one third versus 2.8.6. They cannot explain or promise to eliminate a 175-second provider wait. After installing, Refresh displays preparation, model/request and save times. The bug report adds `panelMs`, `loreMs`, `memoryMs`, `instructionMs` and total timing for diagnosis. `panelMs` measures backend payload construction, not network transport or browser rendering. Read again continues to reread locally without calling the model.

The committed 2.8.1 fixture captures the original package’s four built-in demo worlds. The parity test compares every emitted HMS panel, Plot, Injuries and Chapters output against that baseline. The only allowed difference is the corrected absolute K-year clock in Mushoku Systems and Minds. No baseline panel is removed.
