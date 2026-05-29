import json
import os
import re
import tempfile

import fitz
from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from backend.services.activity_service import log_activity

# ---------------------------------------------------------------------------
# Shared Bedrock model instance
# ---------------------------------------------------------------------------

_llm = ChatBedrock(model="deepseek.v3.2", streaming=True)

BRIEF_PROMPT = """\
You are a legal AI assistant.

Analyze this Indian legal judgment.

Return ONLY valid JSON with exactly these keys:

{{
  "case_title": "",
  "court": "",
  "judgment_date": "",
  "judges": [],
  "petitioner": "",
  "respondent": "",
  "acts_involved": [],
  "constitutional_articles": [],
  "key_legal_issues": [],
  "final_verdict": "",
  "important_observations": [],
  "summary": ""
}}

Do NOT return PDF metadata.
Do NOT return catalog objects.
Do NOT explain — return only the JSON object.

DOCUMENT:
{text}
"""


def _extract_json(text: str) -> dict:
    text = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except Exception as e:
            print("JSON PARSE ERROR:", e)
    return {
        "case_title": "Not clearly mentioned",
        "court": "Not clearly mentioned",
        "judgment_date": "Not clearly mentioned",
        "judges": [],
        "petitioner": "Not clearly mentioned",
        "respondent": "Not clearly mentioned",
        "acts_involved": [],
        "constitutional_articles": [],
        "key_legal_issues": [],
        "final_verdict": "Not clearly mentioned",
        "important_observations": [],
        "summary": text[:2000],
    }


def suggested_actions(case: dict) -> list:
    tags = []
    if case.get("constitutional_articles"):
        tags.append("Constitutional issues detected")
    if case.get("acts_involved"):
        tags.append("Review applicable statutes")
    if case.get("hearing_date"):
        tags.append("Upcoming hearing — prepare notes")
    if not case.get("documents"):
        tags.append("Upload judgment PDF for AI analysis")
    else:
        tags.append("Run AI case brief on uploaded documents")
    return tags


def _extract_pdf_text(file_bytes: bytes, max_chars: int = 4000) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        temp_path = tmp.name
    try:
        doc = fitz.open(temp_path)
        text = ""
        for page in doc:
            text += page.get_text()
            if len(text) >= max_chars:
                break
        doc.close()
        return text[:max_chars]
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def generate_brief_from_bytes(file_bytes: bytes, filename: str, user_id: str = None) -> dict:
    """Generate a structured legal brief using Bedrock DeepSeek with streaming."""
    text = _extract_pdf_text(file_bytes)
    prompt = BRIEF_PROMPT.format(text=text)

    # Stream the response and collect chunks
    full_response = ""
    for chunk in _llm.stream([HumanMessage(content=prompt)]):
        full_response += chunk.content

    brief = _extract_json(full_response)
    brief["source_file"] = filename
    if user_id:
        log_activity(user_id, "Case Brief Generated", filename)
    return brief


def brief_to_pdf(brief: dict, output_path: str) -> None:
    """Render a case brief dict to a PDF file."""
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        textColor=colors.HexColor("#0f2744"),
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#c45c00"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body = styles["BodyText"]

    story = [
        Paragraph("JurisAI — Case Brief", title_style),
        Paragraph(brief.get("case_title", "—"), styles["Heading2"]),
        Spacer(1, 12),
    ]

    sections = [
        ("Court", brief.get("court")),
        ("Judgment Date", brief.get("judgment_date")),
        ("Judges", ", ".join(brief.get("judges", [])) or "—"),
        ("Petitioner", brief.get("petitioner")),
        ("Respondent", brief.get("respondent")),
        ("Acts Involved", ", ".join(brief.get("acts_involved", [])) or "—"),
        ("Constitutional Articles", ", ".join(brief.get("constitutional_articles", [])) or "—"),
    ]
    for label, value in sections:
        story.append(Paragraph(label, heading_style))
        story.append(Paragraph(str(value or "—"), body))
        story.append(Spacer(1, 6))

    story.append(Paragraph("Key Legal Issues", heading_style))
    for issue in brief.get("key_legal_issues", []) or ["—"]:
        story.append(Paragraph(f"• {issue}", body))

    story.append(Paragraph("Important Observations", heading_style))
    for obs in brief.get("important_observations", []) or ["—"]:
        story.append(Paragraph(f"• {obs}", body))

    story.append(Paragraph("Final Verdict", heading_style))
    story.append(Paragraph(str(brief.get("final_verdict", "—")), body))

    story.append(Paragraph("Summary", heading_style))
    story.append(Paragraph(str(brief.get("summary", "—")), body))

    doc.build(story)
