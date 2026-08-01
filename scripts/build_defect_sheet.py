#!/usr/bin/env python3
"""
Add/rebuild the "Defect" sheet in inputdata/Demoblaze_QA_TestCases.xlsx.

This is curated data (defect descriptions, severity, root cause) - it doesn't
come from the Playwright JSON report the way Actual Result/Status do. What
this script DOES pull live from the workbook is the current Status of each
related TC ID (from the Login/Cart/API sheets, which sync_test_results_to_xlsx.py
keeps current), so the "Automation Evidence" column never goes stale relative
to whatever the last sync wrote.

Usage:
    python3 scripts/build_defect_sheet.py [--xlsx inputdata/Demoblaze_QA_TestCases.xlsx]

Safe to re-run: it fully replaces the "Defect" sheet each time rather than
appending, so editing DEFECTS below and re-running is the way to update it.
"""
import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError:
    print("Missing dependency: run `pip install openpyxl` (or `pip install openpyxl --break-system-packages`) first.")
    sys.exit(1)

DEFECTS = [
    {
        "id": "DEF-SYS-001",
        "title": "Guest cart identity not established outside index.html -> shared-bucket data leak between anonymous sessions",
        "area": "Cart / Guest identity",
        "severity": "Critical",
        "related_tc": ["TC-CRT-046"],
        "root_cause": (
            "The guest-cart cookie (user=<uuid>) is only set by js/index.js on the "
            "homepage. Arriving via a direct/bookmarked product link (prod.html) or "
            "cart.html first never sets it, so /viewcart is called with an empty "
            "cookie and the API returns the bucket SHARED by every cookie-less guest "
            "on demoblaze.com - not an empty cart."
        ),
        "evidence": (
            "Verified growing over time from unrelated traffic: 168 items -> 589 "
            "items (next day) -> 720 items (day after). This is a live data leak "
            "between unrelated guest sessions, not stale test data."
        ),
        "reference": "reports/test-cases/TC-CRT-046-definition.md",
    },
    {
        "id": "DEF-001",
        "title": "Credit card field has no format/length/Luhn validation",
        "area": "Checkout",
        "severity": "Critical",
        "related_tc": ["TC-CRT-020", "TC-CRT-027", "TC-CRT-028", "TC-CRT-029", "TC-CRT-030"],
        "root_cause": (
            "purchaseOrder() submits the card field exactly as typed with no "
            "client- or server-side validation: non-numeric characters, spaces, "
            "wrong length (13-19 digits expected), and failing Luhn checksums are "
            "all accepted and the order still succeeds."
        ),
        "evidence": "",
        "reference": "reports/test-cases/financial-validation-rules-and-case-redefinition.md",
    },
    {
        "id": "DEF-002",
        "title": "Expiry month never validated",
        "area": "Checkout",
        "severity": "High",
        "related_tc": ["TC-CRT-031", "TC-CRT-032", "TC-CRT-033"],
        "root_cause": "Month value is accepted as-is: 0, 13, and non-numeric strings all pass through and the order still succeeds.",
        "evidence": "",
        "reference": "reports/test-cases/financial-validation-rules-and-case-redefinition.md",
    },
    {
        "id": "DEF-003",
        "title": "Expiry year never validated",
        "area": "Checkout",
        "severity": "High",
        "related_tc": ["TC-CRT-035", "TC-CRT-036", "TC-CRT-037", "TC-CRT-038"],
        "root_cause": (
            "Year value is accepted as-is: already-expired years, 2-digit years, "
            "far-future years, and non-numeric strings all pass through and the "
            "order still succeeds. TC-CRT-022 (older duplicate, past-year case) "
            "still asserts the old permissive behavior and has not been redefined "
            "to match this defect yet - see Notes on that row."
        ),
        "evidence": "",
        "reference": "reports/test-cases/financial-validation-rules-and-case-redefinition.md",
    },
    {
        "id": "DEF-004",
        "title": "Empty cart can still be \"placed\" as a 0 USD order",
        "area": "Checkout",
        "severity": "Medium",
        "related_tc": ["TC-CRT-023b"],
        "root_cause": (
            "Nothing disables the Place Order button or rejects submission when "
            "the cart has zero items; purchaseOrder() happily creates an order ID "
            "for 0 USD. TC-CRT-023 (older duplicate) still asserts the old "
            "permissive behavior."
        ),
        "evidence": "",
        "reference": "reports/test-cases/financial-validation-rules-and-case-redefinition.md",
    },
    {
        "id": "DEF-005",
        "title": "Purchase button stays clickable behind the SweetAlert success popup",
        "area": "Checkout",
        "severity": "Medium",
        "related_tc": ["TC-CRT-047"],
        "root_cause": (
            "The Place Order modal is not disabled/hidden when the SweetAlert "
            "success confirmation appears on top of it, so the Purchase button "
            "underneath remains visible and clickable - a second click while the "
            "confirmation is showing can plausibly fire a duplicate order."
        ),
        "evidence": "",
        "reference": "reports/test-cases/Implementation-checklist-for-manual-TC.md",
    },
    {
        "id": "DEF-006",
        "title": "Invoice date is off by one month on every order",
        "area": "Checkout",
        "severity": "Low",
        "related_tc": [],
        "root_cause": (
            "purchaseOrder() builds the invoice date with `date.getMonth()` "
            "without the customary +1 (getMonth() is 0-indexed in JavaScript), so "
            "every invoice prints the previous month. Present on every passing "
            "checkout test today - nothing currently asserts on the date, so it "
            "has gone unnoticed."
        ),
        "evidence": "Not automated yet - no TC ID/test case covers this.",
        "reference": "reports/test-cases/cart-failure-analysis.md",
    },
    {
        "id": "DEF-API-001",
        "title": "API layer performs almost no input validation or auth enforcement",
        "area": "API (/login, /purchaseorder, /viewcart, /addtocart, /deleteitem, /view)",
        "severity": "Critical",
        "related_tc": [],
        "root_cause": (
            "Nearly every malformed or invalid request (wrong credentials, SQL-injection-shaped "
            "input, missing required fields, invalid IDs, missing auth cookie) returns HTTP 200 "
            "instead of 400/401/404. Full request/response matrix in the reference doc; the API "
            "sheet's automated checks (API-LOG-*, API-CART-*, API-PROD-*, API-ADD-*, API-DEL-*, "
            "API-ORD-*) enforce the correct status codes and currently fail against the live API "
            "for this reason - see the API sheet's Status column for the current count."
        ),
        "evidence": "",
        "reference": "docs/api-analysis/BUG_REPORT_API_FAILURES.md",
    },
    {
        "id": "DEF-TEST-001",
        "title": "DEF-00x checkout test cases were hanging for ~96-100s instead of failing fast",
        "area": "Test infrastructure (not an app defect)",
        "severity": "Low",
        "related_tc": ["TC-CRT-020", "TC-CRT-027", "TC-CRT-028", "TC-CRT-029", "TC-CRT-030",
                       "TC-CRT-031", "TC-CRT-032", "TC-CRT-033", "TC-CRT-035", "TC-CRT-036",
                       "TC-CRT-037", "TC-CRT-038", "TC-CRT-023b"],
        "root_cause": (
            "clickPurchaseExpectingAlert() waits indefinitely for a native "
            "window.alert() to confirm the app rejected bad input. Since DEF-001/002/003 "
            "mean the app never shows that alert (it just submits the order instead), the "
            "wait never resolves and every one of these tests ran to the full 90-120s "
            "config timeout before failing - correct end result (Fail), wrong reason "
            "(timeout, not a clean assertion), and ~20+ minutes wasted per full run. "
            "Fixed by racing the alert against the SweetAlert success popup with a short "
            "bound, so these now fail in a few seconds with a clear message instead."
        ),
        "evidence": "Logged from reports/test-results/archive/2026-08-01-run-001/results.json (durations 95.7s-100.0s).",
        "reference": "reports/test-cases/cart-failure-analysis.md",
    },
]

HEADERS = [
    "Defect ID", "Title", "Area", "Severity", "Related TC IDs",
    "Root Cause", "Automation Evidence (live)", "Reference",
]

SEVERITY_FILL = {
    "Critical": "FFC7CE",
    "High": "FFE4B5",
    "Medium": "FFF2CC",
    "Low": "E2EFDA",
}


def read_tc_status(wb, tc_ids):
    """Look up each TC ID's current Status/Actual Result from the Login/Cart/API
    sheets so the Defect sheet's evidence column reflects the latest sync,
    not a hand-typed snapshot that will silently go stale."""
    status_by_tc = {}
    for sheet_name in ("Login", "Cart", "API"):
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        header_row, headers = None, {}
        for r in range(1, 6):
            for c in range(1, ws.max_column + 1):
                if str(ws.cell(row=r, column=c).value).strip() == "TC ID":
                    header_row = r
                    for cc in range(1, ws.max_column + 1):
                        v = ws.cell(row=r, column=cc).value
                        if v:
                            headers[str(v).strip()] = cc
                    break
            if header_row:
                break
        if not header_row:
            continue
        col_tcid = headers.get("TC ID")
        col_status = headers.get("Status")
        for r in range(header_row + 1, ws.max_row + 1):
            tcid = ws.cell(row=r, column=col_tcid).value
            if tcid and str(tcid).strip() in tc_ids:
                status_by_tc[str(tcid).strip()] = ws.cell(row=r, column=col_status).value
    return status_by_tc


def build_evidence_text(defect, status_by_tc):
    if defect["evidence"]:
        base = defect["evidence"]
    else:
        base = ""
    if not defect["related_tc"]:
        return base or "No automated TC currently covers this."
    parts = [f"{tc}: {status_by_tc.get(tc, 'not found')}" for tc in defect["related_tc"]]
    joined = " | ".join(parts)
    return f"{base} ({joined})" if base else joined


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", default="inputdata/Demoblaze_QA_TestCases.xlsx")
    args = parser.parse_args()

    xlsx_path = Path(args.xlsx)
    if not xlsx_path.exists():
        print(f"No xlsx file at {xlsx_path}.")
        sys.exit(1)

    backup_path = xlsx_path.with_name(
        f"{xlsx_path.stem}.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}{xlsx_path.suffix}"
    )
    shutil.copy2(xlsx_path, backup_path)
    print(f"Backup written: {backup_path}")

    wb = openpyxl.load_workbook(xlsx_path)
    all_related_tc = {tc for d in DEFECTS for tc in d["related_tc"]}
    status_by_tc = read_tc_status(wb, all_related_tc)

    if "Defect" in wb.sheetnames:
        del wb["Defect"]
    ws = wb.create_sheet("Defect", index=wb.sheetnames.index("API") + 1 if "API" in wb.sheetnames else len(wb.sheetnames))

    bold = Font(bold=True)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="4472C4")
    wrap = Alignment(wrap_text=True, vertical="top")

    ws.cell(row=1, column=1, value="Defect – Found while building the automation suite").font = Font(bold=True, size=14)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(HEADERS))

    for c, h in enumerate(HEADERS, start=1):
        cell = ws.cell(row=2, column=c, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap

    r = 3
    for defect in DEFECTS:
        evidence = build_evidence_text(defect, status_by_tc)
        row_values = [
            defect["id"],
            defect["title"],
            defect["area"],
            defect["severity"],
            ", ".join(defect["related_tc"]) if defect["related_tc"] else "(none automated yet)",
            defect["root_cause"],
            evidence,
            defect["reference"],
        ]
        for c, v in enumerate(row_values, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = wrap
        sev_cell = ws.cell(row=r, column=4)
        fill_color = SEVERITY_FILL.get(defect["severity"])
        if fill_color:
            sev_cell.fill = PatternFill("solid", fgColor=fill_color)
        ws.cell(row=r, column=1).font = bold
        r += 1

    widths = [14, 46, 26, 10, 24, 55, 55, 40]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A3"

    wb.save(xlsx_path)
    print(f"Saved: {xlsx_path}")
    print(f"Defect sheet: {len(DEFECTS)} defects written.")


if __name__ == "__main__":
    main()
