# Changelog

## v1.1.2 - 2026-06-15

- Improved WebView2 compatibility on machines that rendered an empty app window.
- Disabled WebView2 GPU acceleration and removed the transparent WPF host surface.
- Added visible startup error dialogs for WebView2 initialization, process and navigation failures.
- Fixed the main window size based on the current screen work area and disabled manual resizing.
- Updated version metadata, installer metadata and documentation for the v1.1.2 release.

## v1.1.1 - 2026-06-13

- Added the visible `@Jayden` watermark in the app, linked to the GitHub repository.
- Rebuilt the release package so the installer and portable zip include all v1.1 updates.
- Updated version metadata, installer metadata and documentation for the v1.1.1 release.

## v1.1.0 - 2026-06-11

- Added account groups with create, rename, delete, collapse and move support.
- Added account editing from the card three-dot menu and right-click menu.
- Added single-instance startup so launching KManager again restores the existing window.
- Moved user data and WebView2 cache to `%LOCALAPPDATA%\KManager`.
- Added automatic migration from the v1.0 installer data directory to the new user data directory.
- Updated project metadata and documentation for the v1.1.0 release.

## v1.0.0

- Initial public release.
