import logging
from pathlib import Path

from docx import Document
from lxml import etree

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path("uploads/doc_templates")
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

BOOKMARK_FIELDS = [
    "RAW_REPORT_TITLE",
    "RAW_CLIENT_NAME",
    "RAW_ENGAGEMENT_TYPE",
    "RAW_REPORT_DATE",
    "RAW_LEAD_CONSULTANT",
    "RAW_PREPARED_BY",
]


def get_template_path(engagement_type: str) -> Path | None:
    """Returns Path to the template file if it exists, else None."""
    path = TEMPLATE_DIR / f"{engagement_type}.docx"
    return path if path.exists() else None


def load_template_document(engagement_type: str) -> Document:
    """
    Load the .docx template for this engagement type.
    Raises FileNotFoundError if no template has been uploaded.
    """
    path = get_template_path(engagement_type)
    if path is None:
        raise FileNotFoundError(f"No template uploaded for engagement type: {engagement_type}")
    return Document(str(path))


def inject_cover_page_bookmarks(doc: Document, context: dict) -> Document:
    """
    Find named Word bookmarks in the document and replace their text
    with values from the context dict.

    Bookmark → value mapping:
      RAW_REPORT_TITLE     → context["report"]["title"]
      RAW_CLIENT_NAME      → context["client"]["name"]
      RAW_ENGAGEMENT_TYPE  → context["engagement"]["type_display"]
      RAW_REPORT_DATE      → today's date formatted as "January 15, 2025"
      RAW_LEAD_CONSULTANT  → context["engagement"]["lead_consultant"] or ""
      RAW_PREPARED_BY      → context["firm_name"] or ""
    """
    from datetime import date

    today = date.today()
    # strftime %-d (no-pad day) is Linux-only; strip leading zero manually for portability
    date_str = today.strftime("%B %d, %Y").lstrip("0").replace(" 0", " ")

    bookmark_values: dict[str, str] = {
        "RAW_REPORT_TITLE": context["report"]["title"] or "",
        "RAW_CLIENT_NAME": context["client"]["name"] or "",
        "RAW_ENGAGEMENT_TYPE": context["engagement"]["type_display"] or "",
        "RAW_REPORT_DATE": date_str,
        "RAW_LEAD_CONSULTANT": context["engagement"]["lead_consultant"] or "",
        "RAW_PREPARED_BY": context["firm_name"] or "",
    }

    body = doc.element.body
    w = WORD_NS

    # Find all bookmarkStart elements
    bookmark_starts = body.findall(f".//{{{w}}}bookmarkStart")
    for bm_start in bookmark_starts:
        bm_name = bm_start.get(f"{{{w}}}name")
        if bm_name not in bookmark_values:
            continue

        value = bookmark_values[bm_name]

        # Find the parent paragraph
        parent = bm_start.getparent()
        if parent is None:
            logger.warning("Bookmark %s has no parent element — skipping", bm_name)
            continue

        # Find the corresponding bookmarkEnd by id
        bm_id = bm_start.get(f"{{{w}}}id")

        # Collect runs between bookmarkStart and bookmarkEnd in this paragraph
        in_bookmark = False
        runs_to_clear: list = []
        first_rpr: object = None

        for child in list(parent):
            tag = etree.QName(child).localname
            if tag == "bookmarkStart" and child.get(f"{{{w}}}name") == bm_name:
                in_bookmark = True
                continue
            if tag == "bookmarkEnd" and child.get(f"{{{w}}}id") == bm_id:
                in_bookmark = False
                continue
            if in_bookmark and tag == "r":
                runs_to_clear.append(child)
                if first_rpr is None:
                    rpr = child.find(f"{{{w}}}rPr")
                    if rpr is not None:
                        first_rpr = rpr

        # Remove existing runs between the bookmarks
        for run in runs_to_clear:
            parent.remove(run)

        # Insert a new run with the replacement text
        new_run = etree.SubElement(parent, f"{{{w}}}r")
        if first_rpr is not None:
            import copy
            new_run.insert(0, copy.deepcopy(first_rpr))

        # Position the new run after bookmarkStart
        bm_start_idx = list(parent).index(bm_start)
        parent.remove(new_run)
        parent.insert(bm_start_idx + 1, new_run)

        t_elem = etree.SubElement(new_run, f"{{{w}}}t")
        t_elem.text = value
        if value and (value[0] == " " or value[-1] == " "):
            t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

        logger.debug("Injected bookmark %s = %r", bm_name, value)

    return doc
