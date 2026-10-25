# Six-Sided World compatibility in HMS 2.8.2 beta

Install the ZIP as the RPG Companion extension in Lumiverse. The character card and HMS Reporter preset are unchanged.

The Mushoku reader accepts both Living World and Six-Sided World HUD field names. Six-Sided's named month and day are retained, and the calendar clock orders dates by year, month, and day. The world card shows mana capacity and reserve separately, reads Sword Style and Magic Tiers, and keeps the player's sandbox arc separate from the canon saga reference. The lorebook's 22 arc entries supply titles and opening years when available; an arc's year alone does not establish player participation or whether an event occurred. The spell list treats rank eligibility as study access, not ownership. Spell learning still depends on observed casts, study reports, or explicit player marking. The fight setup menu does not grant spells. Missing study percentages remain unknown.

The existing family, NPC Minds, Gear, Atlas, and Lorebook trackers remain in place. The objectives prompt distinguishes an NPC request from a goal the player accepts. The Atlas's existing path matcher can show custom rooms below a known location; this release does not generate new permanent lorebook nodes for custom estates. Canon divergence and event outcomes are recorded by the existing plot and Chronicle features when narrated, not inferred from a canon date.

Run `node tools/test_six_sided_compat.cjs` from the extension folder. This covers HUD extraction for both formats, dated clocks, ranks and casting, personal versus canon arcs, and 22 lorebook arc entries. Test the extension in a live Lumiverse chat before treating automatic reports as fully validated.
