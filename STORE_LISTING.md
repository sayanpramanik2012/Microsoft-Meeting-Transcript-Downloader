# Microsoft Edge Add-ons listing copy

## Description

Long Teams meetings can produce transcripts that are difficult to save reliably from the browser. Transcript Capture for Teams lets you capture an open, completed Microsoft Teams transcript and download it as a readable plain-text file.

Open the transcript pane, select the extension, and start the recorder. Auto-capture moves through the transcript’s virtualized list, collects the available rows, and checks coverage before you download. The status clearly shows how many rows were captured and warns you if anything appears to be missing. The downloaded file keeps transcript order, speaker names, timestamps, and transcription start or stop messages.

The extension runs only when you invoke it. Transcript information is processed locally in the selected tab and is never sent to the developer or a third party. There are no accounts, ads, analytics, tracking systems, external services, or remotely hosted code.

Use this extension only for meetings and transcripts you are authorized to access. Transcript Capture for Teams is an independent extension and is not affiliated with or endorsed by Microsoft.

## Suggested search terms

- Teams transcript
- meeting transcript
- transcript downloader
- transcript export
- meeting notes

## Certification notes

1. Open Microsoft Teams on the web and open a completed meeting transcript.
2. Open the extension popup and select **Start recorder**.
3. Select **Auto-capture all** and wait for the coverage status to finish.
4. Select **Download transcript** to create `Teams_Transcript_Complete.txt`.
5. Select **Stop recorder** to clear the temporary in-tab capture.

The extension uses only `activeTab` and `scripting`. All processing is local to the user-selected tab. No external account, service, payment, or test credential is required beyond access to a Microsoft Teams transcript.

