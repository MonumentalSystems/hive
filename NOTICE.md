# Notice of Modifications

This repository (`MonumentalSystems/hive`) is a fork of [HiveTalk/hivetalksfu](https://github.com/HiveTalk/hivetalksfu),
which itself derives from [miroslavpejic85/mirotalksfu](https://github.com/miroslavpejic85/mirotalksfu).

Original copyright © HiveTalk contributors and the upstream MiroTalk SFU
contributors. Licensed under the GNU Affero General Public License v3.0
(AGPL-3.0). See [LICENSE](./LICENSE) for the full license text.

## Modifications by Monumental Systems

Starting **2026-04-28**, Monumental Systems has modified this codebase to
operate the public service at <https://hive.gnostr.cloud>. Changes include:

- Rebranded UI for the gnostr.cloud developer community (hero copy, logo,
  page titles, footer), keeping the same underlying SFU functionality.
- New theme stylesheet (`public/css/gnostr-theme.css`) layered over the
  upstream `landing.css`; full-page wizards/honeycomb background art
  (`public/images/wizards_hive.png`).
- Resolved an unmerged `<<<<<<< HEAD` conflict marker in `public/views/login.html`.

This fork remains AGPL-3.0. Per AGPL §13, the corresponding source for the
running service at hive.gnostr.cloud is this repository,
<https://github.com/MonumentalSystems/hive>.
