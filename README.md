# Transcript Capture for Teams

A privacy-focused Microsoft Edge extension that captures a completed Microsoft Teams transcript and downloads it as a plain-text file.

## Features

- Uses one **Capture transcript** action to start the complete workflow.
- Handles the virtualized transcript list used by Microsoft Teams.
- Auto-scrolls forward and backward to capture transcript rows.
- Reports captured, expected, and missing row counts.
- Preserves speaker names, timestamps, transcript text, and transcription lifecycle events.
- Verifies complete coverage and automatically downloads `Teams_Transcript_Complete.txt`.
- Offers retry or partial-download recovery only when some rows cannot be captured.
- Does not use analytics, advertising, external services, or remote code.

## Install locally for testing

1. Open `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `extension` directory from this repository.
5. Open a completed Microsoft Teams transcript, select the extension, and choose **Capture transcript**.

## Permissions

- `activeTab`: temporary access to the tab selected by the user.
- `scripting`: injects the packaged recorder into that tab after the user selects **Start recorder**.

The extension requests no persistent host access, downloads permission, storage permission, or background access.

## Privacy

Transcript content is processed locally in the active browser tab. It is not sent to the developer or any third party.

[Read the privacy policy](https://sayanpramanik2012.github.io/Microsoft-Meeting-Transcript-Downloader/privacy-policy.html)

## Disclaimer

This is an independent extension and is not affiliated with, endorsed by, or sponsored by Microsoft. Microsoft Teams is a trademark of Microsoft Corporation.

