# SRD attribution and content scope

This project includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

This repository's D&D-compatible implementation is based on SRD 5.2.1. This does not mean the repository contains every option in every D&D rulebook. Options omitted from the SRD (including species and subclasses) must be implemented as original content or supplied under a separate license by the rights holder.

The SRD 5.2.1 uses the revised 2024 fifth-edition rules. The project should keep this ruleset separate from the 2014-era SRD 5.1 rules where they differ.

Source: https://www.dndbeyond.com/srd


## Structured monster dataset
The monster bestiary in `src/mmorpg/data/monsters.json` includes structured content from the D&D System Reference Document v5.2.1, © Wizards of the Coast LLC, licensed under CC BY 4.0. The structured dataset was republished by Open5e (https://api.open5e.com/, document slug: `wotc-srd`) and redistributed by the `adkinn/srd-5.2.1` dataset project. Dataset source attribution: D&D System Reference Document v5.2.1, Wizards of the Coast LLC, https://www.dndbeyond.com/sources/dnd/srd-5.2.1, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: data is stored in the GB-Quest project and consumed by a custom lookup and encounter runtime; source stat-block fields and descriptions are retained.
