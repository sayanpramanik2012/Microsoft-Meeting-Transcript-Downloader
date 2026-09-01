#!/usr/bin/env python3
"""Generate Chrome Web Store screenshots for Transcript Capture for Teams."""

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "store-assets"
ICON_PATH = ROOT / "extension" / "icons" / "icon-128.png"

WIDTH = 1280
HEIGHT = 800

INK = "#27223B"
MUTED = "#6F6A7E"
ACCENT = "#6654D9"
ACCENT_DARK = "#4C39B7"
ACCENT_LIGHT = "#998BEB"
LAVENDER = "#F0EDFF"
LINE = "#E4E1EF"
SUCCESS = "#248B69"
WARNING = "#C4475D"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(name, size)


FONTS = {
    "eyebrow": font(17, True),
    "headline": font(48, True),
    "subhead": font(22),
    "body": font(18),
    "body_bold": font(18, True),
    "small": font(14),
    "small_bold": font(14, True),
    "tiny": font(12),
    "popup_title": font(18, True),
    "popup_subtitle": font(13, True),
    "button": font(15, True),
    "status": font(14, True),
    "metric": font(13),
    "metric_bold": font(13, True),
    "document": font(15),
    "document_bold": font(15, True),
}


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, selected_font, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=selected_font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_block(draw, xy, text, selected_font, fill, max_width, spacing=8) -> int:
    x, y = xy
    lines = wrap_text(draw, text, selected_font, max_width)
    line_height = selected_font.getbbox("Ag")[3] - selected_font.getbbox("Ag")[1]
    for line in lines:
        draw.text((x, y), line, font=selected_font, fill=fill)
        y += line_height + spacing
    return y


def make_canvas() -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), "#F9F8FE")
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((780, -330, 1470, 360), fill=(149, 135, 235, 50))
    gd.ellipse((-280, 510, 420, 1110), fill=(104, 198, 220, 25))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    canvas.paste(glow, (0, 0), glow)
    return canvas


def paste_icon(canvas: Image.Image, xy, size: int):
    icon = Image.open(ICON_PATH).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(icon, xy, icon)


def draw_brand(canvas: Image.Image):
    draw = ImageDraw.Draw(canvas)
    paste_icon(canvas, (64, 44), 54)
    draw.text((130, 53), "Transcript Capture", font=FONTS["popup_title"], fill=INK)
    draw.text((130, 76), "for Microsoft Teams", font=FONTS["popup_subtitle"], fill=MUTED)


def draw_copy(canvas: Image.Image, headline: str, subhead: str, bullets: Iterable[str] = ()):
    draw = ImageDraw.Draw(canvas)
    draw.text((66, 174), "TRANSCRIPT CAPTURE FOR TEAMS", font=FONTS["eyebrow"], fill=ACCENT)
    y = text_block(draw, (64, 215), headline, FONTS["headline"], INK, 525, spacing=8)
    y = text_block(draw, (66, y + 24), subhead, FONTS["subhead"], MUTED, 500, spacing=8)
    y += 28
    for item in bullets:
        draw.ellipse((68, y + 7, 80, y + 19), fill=ACCENT)
        draw.line((72, y + 13, 75, y + 16, 81, y + 8), fill=WHITE, width=2)
        y = text_block(draw, (92, y), item, FONTS["body"], INK, 455, spacing=5) + 13


def shadow_card(canvas: Image.Image, box, radius=20, shadow=22):
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((x1 + 4, y1 + 12, x2 + 4, y2 + 12), radius=radius, fill=(51, 39, 112, 45))
    layer = layer.filter(ImageFilter.GaussianBlur(shadow))
    canvas.paste(layer, (0, 0), layer)
    rounded(ImageDraw.Draw(canvas), box, radius, WHITE, LINE, 1)


def draw_browser(canvas: Image.Image, box=(620, 120, 1214, 708)):
    draw = ImageDraw.Draw(canvas)
    shadow_card(canvas, box, radius=20)
    x1, y1, x2, y2 = box
    rounded(draw, (x1, y1, x2, y1 + 58), 20, "#F5F4F9")
    draw.rectangle((x1, y1 + 37, x2, y1 + 58), fill="#F5F4F9")
    for index, color in enumerate(("#FF6B6B", "#F6C453", "#48C78E")):
        draw.ellipse((x1 + 22 + index * 23, y1 + 23, x1 + 34 + index * 23, y1 + 35), fill=color)
    rounded(draw, (x1 + 118, y1 + 16, x2 - 22, y1 + 43), 8, WHITE, LINE)
    draw.text((x1 + 137, y1 + 21), "teams.microsoft.com", font=FONTS["tiny"], fill=MUTED)

    draw.rectangle((x1 + 22, y1 + 78, x2 - 22, y2 - 22), fill="#FBFBFD")
    draw.text((x1 + 45, y1 + 101), "Meeting transcript", font=FONTS["popup_title"], fill=INK)
    draw.text((x1 + 45, y1 + 130), "Project status review", font=FONTS["small"], fill=MUTED)
    draw.line((x1 + 45, y1 + 160, x2 - 45, y1 + 160), fill=LINE, width=1)

    rows = [
        ("00:04", "Ava Williams", "Good morning. Let's review the open actions."),
        ("00:18", "Noah Martin", "The deployment completed and monitoring looks stable."),
        ("00:41", "Ava Williams", "Great. Please add the validation result to the notes."),
        ("01:02", "Noah Martin", "I'll share the final update with the team today."),
    ]
    y = y1 + 185
    for timestamp, speaker, message in rows:
        draw.text((x1 + 45, y), timestamp, font=FONTS["small_bold"], fill=ACCENT)
        draw.text((x1 + 105, y), speaker, font=FONTS["small_bold"], fill=INK)
        text_block(draw, (x1 + 105, y + 25), message, FONTS["small"], MUTED, 380, spacing=3)
        y += 88


def progress_ring(draw, center, percent: int):
    cx, cy = center
    box = (cx - 29, cy - 29, cx + 29, cy + 29)
    draw.ellipse(box, outline="#ECEAF4", width=7)
    if percent:
        draw.arc(box, start=-90, end=-90 + int(percent * 3.6), fill=ACCENT, width=7)
    label = f"{percent}%"
    bbox = draw.textbbox((0, 0), label, font=FONTS["tiny"])
    draw.text((cx - (bbox[2] - bbox[0]) / 2, cy - 7), label, font=FONTS["tiny"], fill=ACCENT)


def draw_popup(canvas: Image.Image, xy, state="ready"):
    x, y = xy
    w, h = 350, 520
    draw = ImageDraw.Draw(canvas)
    shadow_card(canvas, (x, y, x + w, y + h), radius=17, shadow=16)
    paste_icon(canvas, (x + 24, y + 22), 48)
    draw.text((x + 84, y + 27), "Transcript Capture", font=FONTS["popup_title"], fill=INK)
    draw.text((x + 84, y + 51), "for Microsoft Teams", font=FONTS["popup_subtitle"], fill="#4F4A60")
    text_block(
        draw,
        (x + 24, y + 91),
        "Capture and save a completed meeting transcript as a clean text file.",
        FONTS["small"],
        MUTED,
        300,
        spacing=4,
    )

    states = {
        "ready": {
            "button": "Capture transcript",
            "percent": 0,
            "title": "Ready to capture",
            "detail": "Open a completed Teams transcript to begin.",
            "captured": "—",
            "missing": "—",
            "activity": "One-click capture",
            "activity_detail": "Scrolls, collects every row, and downloads automatically.",
            "dot": "#9A96A6",
        },
        "capturing": {
            "button": "Capturing...",
            "percent": 57,
            "title": "Capturing transcript...",
            "detail": "57% complete",
            "captured": "87 / 154 rows",
            "missing": "67",
            "activity": "Auto-scrolling in progress",
            "activity_detail": "The recorder is collecting all visible transcript rows.",
            "dot": ACCENT,
        },
        "complete": {
            "button": "Capture again",
            "percent": 100,
            "title": "Transcript downloaded",
            "detail": "154 rows captured successfully.",
            "captured": "154 / 154 rows",
            "missing": "0",
            "activity": "Download complete",
            "activity_detail": "Saved to your browser's download folder.",
            "dot": SUCCESS,
        },
    }
    data = states[state]

    button_y = y + 148
    rounded(draw, (x + 24, button_y, x + w - 24, button_y + 48), 9, ACCENT_LIGHT)
    if state == "capturing":
        draw.arc((x + 105, button_y + 15, x + 123, button_y + 33), 20, 290, fill=WHITE, width=2)
    button_box = draw.textbbox((0, 0), data["button"], font=FONTS["button"])
    draw.text(
        (x + (w - (button_box[2] - button_box[0])) / 2 + (10 if state == "capturing" else 0), button_y + 15),
        data["button"],
        font=FONTS["button"],
        fill=WHITE,
    )

    card_y = button_y + 64
    rounded(draw, (x + 24, card_y, x + w - 24, y + h - 52), 11, WHITE, LINE)
    progress_ring(draw, (x + 61, card_y + 48), data["percent"])
    draw.text((x + 103, card_y + 27), data["title"], font=FONTS["status"], fill=ACCENT_DARK)
    text_block(draw, (x + 103, card_y + 51), data["detail"], FONTS["tiny"], MUTED, 210, spacing=2)

    stats_y = card_y + 91
    draw.text((x + 40, stats_y), "Captured", font=FONTS["metric"], fill=MUTED)
    right = draw.textbbox((0, 0), data["captured"], font=FONTS["metric_bold"])[2]
    draw.text((x + w - 40 - right, stats_y), data["captured"], font=FONTS["metric_bold"], fill=ACCENT)
    draw.line((x + 40, stats_y + 27, x + w - 40, stats_y + 27), fill="#EFEDF4")
    draw.text((x + 40, stats_y + 40), "Missing", font=FONTS["metric"], fill=MUTED)
    right = draw.textbbox((0, 0), data["missing"], font=FONTS["metric_bold"])[2]
    draw.text((x + w - 40 - right, stats_y + 40), data["missing"], font=FONTS["metric_bold"], fill=INK)

    activity_y = stats_y + 82
    draw.line((x + 25, activity_y, x + w - 25, activity_y), fill=LINE)
    draw.ellipse((x + 40, activity_y + 20, x + 50, activity_y + 30), fill=data["dot"])
    draw.text((x + 62, activity_y + 15), data["activity"], font=FONTS["small_bold"], fill="#555064")
    text_block(draw, (x + 62, activity_y + 39), data["activity_detail"], FONTS["tiny"], "#85808F", 245, spacing=3)

    draw.line((x + 24, y + h - 52, x + w - 24, y + h - 52), fill=LINE)
    draw.ellipse((x + 28, y + h - 31, x + 38, y + h - 21), outline=ACCENT, width=2)
    draw.text((x + 47, y + h - 35), "Your transcript stays on your device.", font=FONTS["tiny"], fill=MUTED)


def draw_file_badge(canvas: Image.Image, xy):
    x, y = xy
    draw = ImageDraw.Draw(canvas)
    shadow_card(canvas, (x, y, x + 340, y + 90), radius=14, shadow=12)
    rounded(draw, (x + 18, y + 17, x + 72, y + 72), 11, LAVENDER)
    draw.line((x + 38, y + 29, x + 38, y + 52), fill=ACCENT, width=4)
    draw.line((x + 29, y + 44, x + 38, y + 53, x + 47, y + 44), fill=ACCENT, width=4)
    draw.text((x + 88, y + 21), "Teams_Transcript_Complete.txt", font=FONTS["small_bold"], fill=INK)
    draw.text((x + 88, y + 48), "Downloaded automatically", font=FONTS["small"], fill=SUCCESS)


def draw_document(canvas: Image.Image, box):
    x1, y1, x2, y2 = box
    draw = ImageDraw.Draw(canvas)
    shadow_card(canvas, box, radius=18)
    draw.text((x1 + 36, y1 + 30), "Teams_Transcript_Complete.txt", font=FONTS["popup_title"], fill=INK)
    draw.text((x2 - 118, y1 + 34), "Plain text", font=FONTS["small_bold"], fill=ACCENT)
    draw.line((x1 + 36, y1 + 68, x2 - 36, y1 + 68), fill=LINE)
    entries = [
        ("[00:04] Ava Williams", "Good morning. Let's review the open actions."),
        ("[00:18] Noah Martin", "The deployment completed and monitoring looks stable."),
        ("[00:41] Ava Williams", "Great. Please add the validation result to the notes."),
        ("[01:02] Noah Martin", "I'll share the final update with the team today."),
    ]
    y = y1 + 94
    for title, message in entries:
        draw.text((x1 + 38, y), title, font=FONTS["document_bold"], fill=ACCENT_DARK)
        text_block(draw, (x1 + 38, y + 29), message, FONTS["document"], INK, x2 - x1 - 76, spacing=4)
        y += 92


def save(canvas: Image.Image, filename: str):
    path = OUTPUT / filename
    canvas.convert("RGB").save(path, format="PNG", optimize=True)
    print(path.relative_to(ROOT))


def screenshot_one():
    canvas = make_canvas()
    draw_brand(canvas)
    draw_copy(
        canvas,
        "Save a complete Teams transcript in one click",
        "Open the transcript, select Capture transcript, and let the extension handle the rest.",
        ("No manual scrolling", "No copy-and-paste cleanup"),
    )
    draw_browser(canvas)
    draw_popup(canvas, (830, 178), "ready")
    save(canvas, "screenshot-1-one-click-capture-1280x800.png")


def screenshot_two():
    canvas = make_canvas()
    draw_brand(canvas)
    draw_copy(
        canvas,
        "Automatic capture from the first row to the last",
        "Live progress shows exactly how many transcript rows have been collected and how many remain.",
        ("Auto-scrolls through virtualized rows", "Checks forward and backward coverage"),
    )
    draw_browser(canvas)
    draw_popup(canvas, (830, 178), "capturing")
    save(canvas, "screenshot-2-automatic-progress-1280x800.png")


def screenshot_three():
    canvas = make_canvas()
    draw_brand(canvas)
    draw_copy(
        canvas,
        "Complete coverage. Automatic download.",
        "The text file downloads only after every available transcript row has been verified.",
        ("Missing-row protection", "Retry and partial recovery when needed"),
    )
    draw_browser(canvas)
    draw_popup(canvas, (830, 154), "complete")
    draw_file_badge(canvas, (66, 650))
    save(canvas, "screenshot-3-automatic-download-1280x800.png")


def screenshot_four():
    canvas = make_canvas()
    draw_brand(canvas)
    draw_copy(
        canvas,
        "Clean text with speakers and timestamps preserved",
        "The downloaded transcript stays readable, ordered, and ready for notes, analysis, or archiving.",
        ("Speaker names and timestamps", "Transcription start and stop events"),
    )
    draw_document(canvas, (650, 154, 1208, 688))
    save(canvas, "screenshot-4-clean-text-output-1280x800.png")


def screenshot_five():
    canvas = make_canvas()
    draw_brand(canvas)
    draw_copy(
        canvas,
        "Private by design. Processed locally.",
        "Transcript content stays in the selected browser tab and is never sent to the developer or a third party.",
        ("No account or external service", "No analytics, ads, or tracking"),
    )
    draw = ImageDraw.Draw(canvas)
    shadow_card(canvas, (672, 166, 1192, 646), radius=24)
    rounded(draw, (716, 214, 1148, 548), 20, "#FAF9FF", LINE)
    draw.ellipse((826, 267, 1038, 479), fill=LAVENDER)
    draw.ellipse((870, 311, 994, 435), fill=WHITE, outline=ACCENT_LIGHT, width=4)
    draw.line((932, 333, 932, 390), fill=ACCENT, width=8)
    draw.arc((900, 322, 964, 382), start=180, end=360, fill=ACCENT, width=8)
    rounded(draw, (897, 371, 967, 420), 10, ACCENT)
    draw.ellipse((928, 388, 936, 396), fill=WHITE)
    draw.line((932, 396, 932, 406), fill=WHITE, width=3)
    draw.text((808, 500), "LOCAL PROCESSING ONLY", font=FONTS["eyebrow"], fill=SUCCESS)
    draw.text((756, 574), "Your transcript never leaves your device", font=FONTS["body_bold"], fill=INK)
    save(canvas, "screenshot-5-private-local-processing-1280x800.png")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    screenshot_one()
    screenshot_two()
    screenshot_three()
    screenshot_four()
    screenshot_five()


if __name__ == "__main__":
    main()
