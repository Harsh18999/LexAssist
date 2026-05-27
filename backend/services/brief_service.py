import json
import os
import re
import tempfile

from llama_index.core import SimpleDirectoryReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from backend.services.activity_service import log_activity
from rag.query_engine import query_engine

BRIEF_PROMPT = """
You are an Indian legal AI assistant. Analyze this judgment and return ONLY valid JSON (no markdown fences).

{{
  "case_title": "",
  "court": "",
  "judgment_date": "",
  "judges": [],
  "petitioner": "",
  "respondent": "",
  "acts_involved": [],
  "constitutional_articles": [],
  "case_overview": "",
  "important_facts": [],
  "legal_issues": [],
  "arguments": [],
  "court_observations": [],
  "precedents": [],
  "final_verdict": "",
  "key_takeaways": [],
  "simplified_explanation": "",
  "risk_tags": [],
  "key_legal_issues": [],
  "important_observations": [],
  "summary": ""
}}

Use "Not clearly mentioned" for missing strings. Use [] if unknown.
LEGAL DOCUMENT:
{text}
"""


def _extract_json(text):
    text = text.strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
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


def suggested_actions(case: dict):
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


def generate_brief_from_bytes(file_bytes, filename, user_id: str = None):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        temp_path = tmp.name

    try:
        documents = SimpleDirectoryReader(input_files=[temp_path]).load_data()
        full_text = "\n".join(doc.text for doc in documents)
        prompt = BRIEF_PROMPT.format(text=full_text[:8000])
        response = query_engine.query(prompt)
        brief = _extract_json(str(response.response))
        brief["source_file"] = filename
        if user_id:
            log_activity(user_id, "Case Brief Generated", filename)
        return brief
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def brief_to_pdf(brief, output_path):
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

    story = []
    story.append(Paragraph("JurisAI — Case Brief", title_style))
    story.append(Paragraph(brief.get("case_title", "—"), styles["Heading2"]))
    story.append(Spacer(1, 12))

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
