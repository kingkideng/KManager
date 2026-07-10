# Changelog

## v2.0 - 2026-07-07 (updated 2026-07-10)

- Added explicit account regions: Asia, Americas, Europe and China.
- Added region-aware Battle.net switching with local session-state snapshots, limited cache cleanup and auth-state restore.
- Added account avatar customization, account deletion from the card menu, and manual login-state refresh.
- Added a region selector when opening Battle.net to log in a new account.
- Added first-run help, legacy-upgrade guidance and FAQ inside the app.
- Preserved old accounts without region tags by opening them with the legacy switching path first, then guiding users to fill the region and update login state.
- Added automatic import from the isolated beta data directory into the official app data directory.
- Fixed first-start hangs caused by repeatedly importing large legacy or beta session-state directories.
- Moved core initialization off the UI thread and added a persisted migration-state record so completed imports are not copied again.
- Added clearer errors for Battle.net exit timeouts, missing configuration and incomplete session-state capture.
- Refreshed the packaged frontend and final release branding assets.

## v1.1.4 - 2026-06-16

- Optimized WebView2 background memory footprint. The app now trims its memory aggressively to ~30MB when minimized or hidden to the system tray.
- Capped WebView2 V8 engine heap size to 128MB and disabled unnecessary background browser processes to lower active memory overhead.
- Added a new minimize button to the window header controls (minimizes to the taskbar).
- Enabled .NET Concurrent Workstation Garbage Collection for a leaner memory footprint.
- Fixed the `X` close button behavior to correctly hide the app to the system tray instead of fully shutting down the process.

## v1.1.3 - 2026-06-16

- Added startup detection for the Microsoft Edge WebView2 Runtime.
- Bundled the Microsoft Edge WebView2 Evergreen Bootstrapper with the app package.
- When the runtime is missing, KManager asks for user confirmation and then runs the Bootstrapper to download and install it.
- Normal machines with a working runtime start without any extra prompt.
- Updated version metadata, installer metadata and documentation for the v1.1.3 release.

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
