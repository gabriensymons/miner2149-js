# Asset Provenance

This inventory records what can be established from the repository. It is not a legal opinion.

## Original project

Miner2149 and its original Palm OS source are credited to Michael Baker/BProjectsGames. Michael Baker granted the project owner written permission to use the original source, formulas, sprites, game imagery, and documentation for this personal, noncommercial, not-for-profit browser project. That project-specific permission supersedes the upstream source release's general restrictions for this authorized use, but it does not grant downstream users a license to copy, modify, or redistribute the covered material.

This repository therefore documents the permission supporting the project without presenting the original or adapted material as generally open-source or sublicensable.

## Assets in this repository

The repository contains:

- a PixiJS sprite sheet and individual interface images;
- bitmap-font PNG and FNT files;
- earlier font-image variants and test outputs;
- `palm-os-bitmap-white-adding-bullet.psd`, an editable source file used while adapting the bitmap font;
- a project screenshot hosted on GitHub user content.

Git history does not identify the exact creator or source of every individual asset. Michael Baker's project-specific permission covers the original game-derived source, sprites, imagery, and documentation described above; third-party material still requires separate provenance. The editable PSD is retained because it appears to be intentional source material for the generated font variants, but its creation history should be documented when known.

## Device frames

The PDA frames in `assets/skins/` are original artwork created for this project, depicting
fictional hardware (AstroDyne, TC-II, TrekStat, EnKom, Precursor, CoreTech, MegaTech,
Giga1-21, DSEF-102, Diridium). They are not derived from any real device and carry no
third-party rights.

They replaced a set of Palm device frames adapted from PalmOS Emulator Skins v1.4, whose
copyright status made them a release blocker. Those frames are gone from the tree; see Git
history if the earlier provenance discussion is ever needed.

Each frame's screen cutout is measured from its own alpha channel by
`tools/measure-skin-cutouts.js` and recorded in `scripts/skin-catalogue.js`, so adding a
frame does not require hand-measuring geometry into CSS.

If the project later offers third-party redistribution or adopts an open-source license, review the written permission's downstream licensing scope first.
