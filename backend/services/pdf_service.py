# backend/services/pdf_service.py
from io import BytesIO
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# Brand palette
C_PURPLE      = colors.HexColor("#9333ea")
C_PURPLE_LITE = colors.HexColor("#f3e8ff")
C_GREEN       = colors.HexColor("#10b981")
C_RED         = colors.HexColor("#ef4444")
C_AMBER       = colors.HexColor("#f59e0b")
C_DARK        = colors.HexColor("#111827")
C_GRAY        = colors.HexColor("#6b7280")
C_LIGHT       = colors.HexColor("#f9fafb")
C_BORDER      = colors.HexColor("#e5e7eb")

DIFF_COLORS = {"easy": C_GREEN, "medium": C_AMBER, "hard": C_RED}


def _hex(c):
    r, g, b = int(c.red*255), int(c.green*255), int(c.blue*255)
    return f"#{r:02x}{g:02x}{b:02x}"


def _fmt_time(seconds):
    if not seconds:
        return "N/A"
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s:02d}s"


def _fmt_date(iso):
    try:
        return datetime.fromisoformat(iso).strftime("%B %d, %Y  %I:%M %p")
    except Exception:
        return iso or ""


class PDFService:
    def generate_results_pdf(self, attempt: dict) -> bytes:
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=18*mm, rightMargin=18*mm,
            topMargin=18*mm, bottomMargin=18*mm,
            title="Quiz Results - NeuraNote",
        )
        story = []
        story += self._header(attempt)
        story.append(Spacer(1, 5*mm))
        story += self._score_card(attempt)
        story.append(Spacer(1, 5*mm))
        story += self._stats_row(attempt)
        story.append(Spacer(1, 8*mm))

        detailed = attempt.get("detailed_results") or []
        if detailed:
            story += self._review_section(detailed)

        story.append(Spacer(1, 8*mm))
        story += self._footer()
        doc.build(story)
        return buf.getvalue()

    def _header(self, attempt):
        difficulty = (attempt.get("difficulty") or "").lower()
        diff_label = difficulty.capitalize() or "N/A"
        diff_color = _hex(DIFF_COLORS.get(difficulty, C_GRAY))

        quiz_title = attempt.get("quiz_title") or "Quiz Results"
        num_q = attempt.get("total_questions", "")
        subtitle = f"{quiz_title}"
        if num_q:
            subtitle = f"{quiz_title} — {num_q} Questions"

        return [
            Spacer(1, 2*mm),
            Paragraph(
                "NeuraNote Quiz Results",
                ParagraphStyle(
                    "Brand", fontSize=22, fontName="Helvetica-Bold",
                    textColor=C_PURPLE, alignment=TA_CENTER,
                    spaceAfter=6, leading=28,
                ),
            ),
            Paragraph(
                subtitle,
                ParagraphStyle(
                    "Title", fontSize=12, fontName="Helvetica-Bold",
                    textColor=C_DARK, alignment=TA_CENTER,
                    spaceAfter=4, leading=18,
                ),
            ),
            Paragraph(
                f'Difficulty:&nbsp;<font color="{diff_color}"><b>{diff_label}</b></font>'
                f'&nbsp;&nbsp;|&nbsp;&nbsp;{_fmt_date(attempt.get("attempt_date", ""))}',
                ParagraphStyle(
                    "Meta", fontSize=9, textColor=C_GRAY,
                    alignment=TA_CENTER, leading=14, spaceAfter=4,
                ),
            ),
            Spacer(1, 4*mm),
            HRFlowable(width="100%", thickness=1.5, color=C_PURPLE),
        ]

    def _score_card(self, attempt):
        score = float(attempt.get("score_percentage") or 0)
        correct = attempt.get("correct_answers", 0)
        total   = attempt.get("total_questions", 0)
        passed  = score >= 50

        score_color = C_GREEN if score >= 70 else (C_AMBER if score >= 50 else C_RED)
        verdict = "Passed!" if passed else "Keep Practicing"

        tbl = Table([[
            Paragraph(f'<font size="34" color="{_hex(score_color)}"><b>{score:.0f}%</b></font>',
                ParagraphStyle("SC", alignment=TA_CENTER, leading=42)),
            Paragraph(
                f'<font size="14"><b>{verdict}</b></font><br/>'
                f'<font size="10" color="{_hex(C_GRAY)}">{correct} correct out of {total} questions</font>',
                ParagraphStyle("VC", leading=22, alignment=TA_LEFT, spaceBefore=2)),
        ]], colWidths=["30%", "70%"])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), C_PURPLE_LITE),
            ("BOX",           (0,0),(-1,-1), 1, C_PURPLE),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0),(-1,-1), 14),
            ("BOTTOMPADDING", (0,0),(-1,-1), 14),
            ("LEFTPADDING",   (0,0),(-1,-1), 12),
            ("RIGHTPADDING",  (0,0),(-1,-1), 12),
        ]))
        return [tbl]

    def _stats_row(self, attempt):
        correct   = attempt.get("correct_answers", 0)
        total     = attempt.get("total_questions", 0)
        incorrect = total - correct
        difficulty = (attempt.get("difficulty") or "").capitalize()

        def stat(value, label):
            return Paragraph(
                f'<font size="17"><b>{value}</b></font><br/>'
                f'<font size="8" color="{_hex(C_GRAY)}">{label}</font>',
                ParagraphStyle("S", fontSize=9, alignment=TA_CENTER, leading=16))

        tbl = Table([[
            stat(str(correct),   "Correct"),
            stat(str(incorrect), "Incorrect"),
            stat(_fmt_time(attempt.get("time_taken")), "Time Taken"),
            stat(difficulty,     "Difficulty"),
        ]], colWidths=["25%"]*4)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), C_LIGHT),
            ("BOX",           (0,0),(-1,-1), 0.5, C_BORDER),
            ("INNERGRID",     (0,0),(-1,-1), 0.5, C_BORDER),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ]))
        return [tbl]

    def _review_section(self, detailed):
        elements = [
            Paragraph("Question Review",
                ParagraphStyle("Sec", fontSize=13, fontName="Helvetica-Bold",
                    textColor=C_DARK, spaceAfter=6*mm, spaceBefore=2*mm)),
        ]

        q_text_s = ParagraphStyle(
            "QT", fontSize=10, textColor=C_DARK,
            leading=16, spaceAfter=3*mm, spaceBefore=3*mm,
            leftIndent=6*mm, rightIndent=6*mm
        )
        ans_s = ParagraphStyle(
            "AS", fontSize=9, leading=14,
            leftIndent=6*mm, rightIndent=6*mm, spaceAfter=2*mm
        )
        q_num_s  = ParagraphStyle("QN", fontSize=10, fontName="Helvetica-Bold", textColor=C_DARK)
        badge_s  = ParagraphStyle("BS", fontSize=9, alignment=TA_RIGHT)

        for i, item in enumerate(detailed):
            is_correct = item.get("is_correct")

            if is_correct is True:
                badge_text  = "✓ CORRECT"
                badge_color = _hex(C_GREEN)
                row_bg      = colors.HexColor("#f0fdf4")
                border_col  = C_GREEN
            elif is_correct is False:
                badge_text  = "✗ INCORRECT"
                badge_color = _hex(C_RED)
                row_bg      = colors.HexColor("#fff1f2")
                border_col  = C_RED
            else:
                badge_text  = "⚑ NEEDS REVIEW"
                badge_color = _hex(C_AMBER)
                row_bg      = colors.HexColor("#fffbeb")
                border_col  = C_AMBER

            # Q number + badge header row
            hdr = Table([[
                Paragraph(f"Question {i+1}", q_num_s),
                Paragraph(f'<font color="{badge_color}"><b>{badge_text}</b></font>', badge_s),
            ]], colWidths=["40%", "60%"])
            hdr.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,-1), row_bg),
                ("LINEBELOW",     (0,0),(-1,-1), 1.5, border_col),
                ("TOPPADDING",    (0,0),(-1,-1), 6),
                ("BOTTOMPADDING", (0,0),(-1,-1), 6),
                ("LEFTPADDING",   (0,0),(-1,-1), 8),
                ("RIGHTPADDING",  (0,0),(-1,-1), 8),
                ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ]))
            elements.append(hdr)

            # Question text
            elements.append(Paragraph(item.get("question_text") or "", q_text_s))

            # Divider before answers
            elements.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER))
            elements.append(Spacer(1, 2*mm))

            # User answer
            user_ans  = item.get("user_answer_text") or item.get("user_answer") or "No answer given"
            ans_color = _hex(C_GREEN) if is_correct is True else _hex(C_RED) if is_correct is False else _hex(C_AMBER)
            elements.append(Paragraph(
                f'<font color="{_hex(C_GRAY)}"><b>Your Answer:&nbsp;&nbsp;</b></font>'
                f'<font color="{ans_color}">{user_ans}</font>', ans_s))

            # Correct answer if wrong
            if is_correct is False:
                correct_ans = item.get("correct_answer_text") or item.get("correct_answer") or ""
                if correct_ans:
                    elements.append(Paragraph(
                        f'<font color="{_hex(C_GRAY)}"><b>Correct Answer:&nbsp;&nbsp;</b></font>'
                        f'<font color="{_hex(C_GREEN)}">{correct_ans}</font>', ans_s))

            # Expected for short answer needing review
            if is_correct is None:
                expected = item.get("correct_answer_text") or ""
                if expected:
                    elements.append(Paragraph(
                        f'<font color="{_hex(C_GRAY)}"><b>Expected Answer:&nbsp;&nbsp;</b></font>{expected}', ans_s))

            elements.append(Spacer(1, 5*mm))

        return elements

    def _footer(self):
        return [
            HRFlowable(width="100%", thickness=0.5, color=C_BORDER),
            Spacer(1, 2*mm),
            Paragraph(
                f"Generated by NeuraNote  |  {datetime.now().strftime('%B %d, %Y  %I:%M %p')}",
                ParagraphStyle("Foot", fontSize=8, textColor=C_GRAY, alignment=TA_CENTER)),
        ]
