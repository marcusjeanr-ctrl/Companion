# Mushoku compatibility in HMS 2.8.6 candidate

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
