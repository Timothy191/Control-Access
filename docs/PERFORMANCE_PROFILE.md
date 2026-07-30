# Performance Profile: Control-Access App

**Date:** 2025-07-29
**App version:** 2.1.0
**Scope:** `_process_qr_scan()`, `gate_logs` pagination, export memory usage

---

## 1. `_process_qr_scan()` — Sequential DB Queries

**Location:** `app.py` lines 2241-2735+

The function performs up to **10+ sequential database queries** per scan. Each query depends on the result of the previous one (fallback chain), so they cannot be parallelized. However, several are candidates for optimization.

### Query Chain (per scan)

| # | Line | Table | Purpose | Index Used |
|---|------|-------|---------|------------|
| 1 | 2269 | `employees` | Lookup by `qr_code` | `qr_code` (unique) |
| 2 | 2292 | `employees` | Fallback: `emp_code` OR `id_number` | `emp_code` (unique), `id_number` (unique) |
| 3 | 2312 | `employees` | Second fallback: `emp_code` OR `id_number` | Same |
| 4 | 2331 | `vehicles` | Lookup by `qr_code` | `qr_code` (unique) |
| 5 | 2339 | `visitors` | Lookup by `qr_code` | `qr_code` (unique) |
| 6 | 2346 | `visitors` | Fallback: lookup by `id` (PK) | Primary key |
| 7 | 2364 | `equipment` | Lookup by `qr_code` OR `radio_id` | `qr_code` (unique), `radio_id` (unique) |
| 8 | 2388 | `gate_logs` | Auto-direction: last log for entity | `entity_id` + `access_type` + `access_granted` (composite needed) |
| 9 | 2432 | `employees` | Special keyword auto-approval | `emp_code` (unique) |
| 10 | 2549 | `gate_logs` | Recent scan auto-approval (10s window) | `qr_data` + `scanned_at` (composite needed) |
| 11 | 2564 | `approvals` | Recent pending approvals (10s window) | `status` + `created_at` (composite needed) |
| 12 | 2650 | `employees` | Auto-created employee lookup | `emp_code` (unique) |

### Eager Loading Opportunities

**No traditional eager loading applies** — queries 1-7 target different tables in a fallback chain (employee -> vehicle -> visitor -> equipment). Only one entity is ever found, so JOINs or `joinedload()` would not help.

**However, these optimizations are applicable:**

1. **Composite indexes missing (HIGH IMPACT):**
   - Query #8 (line 2388): Filters on `(entity_id, access_type, access_granted)` with `ORDER BY scanned_at DESC`. A composite index on `(entity_id, access_type, access_granted, scanned_at)` would eliminate a full table scan on `gate_logs`.
   - Query #10 (line 2549): Filters on `(qr_data, scanned_at)`. A composite index on `(qr_data, scanned_at)` would speed up the 10-second window check.
   - Query #11 (line 2564): Filters on `(status, created_at)`. A composite index on `(status, created_at)` on the `approvals` table.

2. **Reduce query count with a single polymorphic lookup (MEDIUM IMPACT):**
   - Queries 1-7 could be replaced with a single query using a `UNION` across all entity tables, or by maintaining a dedicated `qr_lookup` table mapping `qr_code -> (entity_type, entity_id)`. This reduces worst-case from 7 queries to 1.

3. **`db_session.commit()` calls inside the scan (MEDIUM IMPACT):**
   - Lines 2302, 2322, 2353, 2381, 2487 call `commit()` mid-function to auto-populate `qr_code` fields. Each commit forces a disk sync in SQLite. These could be batched into a single commit at the end.

4. **Approval query loads all pending (LOW-MEDIUM IMPACT):**
   - Line 2564: `.filter(Approval.status == "Pending", Approval.created_at >= ...).all()` loads ALL pending approvals from the last 10 seconds into Python, then iterates to find a QR match. This should use a SQL-level filter on `scanned_data` instead.

---

## 2. `gate_logs` Route — Pagination Status

### Web Route: `GET /gate_logs` (line 1939)

**Pagination: YES — properly implemented.**

- `page` parameter (default 1)
- `per_page` parameter (default 50, capped at 200)
- Uses `query.offset((page - 1) * per_page).limit(per_page).all()`
- Computes `total` and `total_pages` for UI

**Minor issues:**
- `query.count()` on line 1972 runs a separate `SELECT COUNT(*)` query. For large `gate_logs` tables with filters, this can be slow. Consider caching or approximate counts.
- The `not GateLog.access_granted` filter on line 1961 is a Python-side `not` applied to a column expression — this works in SQLAlchemy but is confusing; should be `GateLog.access_granted == False` or `~GateLog.access_granted`.

### API Route: `GET /api/gate_logs` (line 4020)

**Pagination: NO — only has `limit`, no `offset` or cursor.**

- Accepts `limit` parameter (default 100)
- No `offset`, `page`, or cursor-based pagination
- Always returns the most recent N logs
- Clients cannot page through older records

**Recommendation:** Add `offset` parameter or cursor-based pagination to the API route for consistency with the web route.

---

## 3. Export Functions — In-Memory Generation

**All export functions build the entire file in memory** using `io.BytesIO()` before sending. This is a scalability concern for large datasets.

### Excel Exports (openpyxl)

| Route | Line | Data Limit | Memory Risk |
|-------|------|------------|-------------|
| `/export/gate_logs/excel` | 4091 | `.limit(50000)` | HIGH — 50K rows in memory + openpyxl overhead |
| `/export/employees/excel` | 4142 | **No limit** | MEDIUM — all employees loaded at once |
| `/export/visitors/excel` | 4202 | **No limit** | MEDIUM — all visitors loaded at once |
| `/export/fleet/excel` | 4250 | **No limit** | LOW — fleet is typically small |
| `/export/equipment/excel` | 4293 | **No limit** | LOW — equipment is typically small |

**Issues:**
- `openpyxl` does not support streaming writes. The entire workbook is built in memory.
- For 50K gate log rows, peak memory can exceed 200-500 MB depending on column widths and string lengths.
- All rows are loaded with `.all()` before iteration begins.

**Streaming alternatives:**
- Replace `openpyxl` with `xlsxwriter` in **constant memory mode** (`constant_memory=True`), which writes rows directly to disk/temp file.
- Or use `openpyxl`'s **write-only mode** (`workbook = openpyxl.Workbook(write_only=True)`), which streams rows and uses far less memory.
- For the DB query, use `.yield_per(1000)` with server-side cursors to avoid loading all rows at once.

### PDF Exports (ReportLab)

| Route | Line | Data Limit | Memory Risk |
|-------|------|------------|-------------|
| `/export/gate_logs/pdf` | 4777 | `.limit(50000)` | HIGH — 50K rows + ReportLab story objects |
| `/export/employees/pdf` | 4853 | **No limit** | MEDIUM |
| `/export/visitors/pdf` | 4916 | **No limit** | MEDIUM |
| `/export/fleet/pdf` | 4272 | **No limit** | LOW |
| `/export/equipment/pdf` | 4315 | **No limit** | LOW |

**Issues:**
- `generate_pdf()` (line 4603) builds a complete ReportLab `story` list in memory, then renders to `io.BytesIO()`.
- All data rows are converted to `Paragraph` objects before rendering — each Paragraph has significant object overhead.
- For 50K rows, the story list alone can consume 100+ MB.

**Streaming alternatives:**
- ReportLab supports **page-level streaming** via custom `BaseDocTemplate` with `afterPage` callbacks, allowing data to be fetched in chunks.
- Alternatively, generate the PDF in pages: render N pages, flush to a temp file, repeat, then concatenate with `PyPDF2`.
- For moderate improvements: use `.yield_per()` on the query and build story elements in batches.

### QR Code ZIP Exports

| Route | Line | Memory Risk |
|-------|------|-------------|
| `/export/equipment/qr-zip` | 4356 | HIGH — all QR images generated + stored in ZIP buffer |
| `/export/employees/qr-zip` | 4393 | HIGH — same pattern |
| `/export/fleet/qr-zip` | 4431 | MEDIUM — typically fewer vehicles |

**Issues:**
- Each QR code image is generated into a `BytesIO` buffer, then its bytes are written into the ZIP buffer. Peak memory = all images + ZIP file simultaneously.
- No limit on number of records processed.

**Streaming alternatives:**
- Use `zipfile.ZipFile` with a file-backed temporary file instead of `BytesIO`:
  ```python
  import tempfile
  with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
      with zipfile.ZipFile(tmp, "w") as zf:
          for item in items:  # use yield_per()
              ...
              zf.writestr(...)
      tmp.seek(0)
      return send_file(tmp, ...)
  ```
- Generate QR images one at a time and discard immediately after writing to ZIP.

---

## Summary of Recommendations (Priority Order)

| Priority | Area | Action | Expected Impact |
|----------|------|--------|-----------------|
| P0 | Exports | Switch Excel exports to `openpyxl` write-only mode or `xlsxwriter` constant memory | Reduce peak memory 5-10x for large exports |
| P0 | Exports | Add `.yield_per(1000)` to all export queries | Avoid loading all rows into Python at once |
| P1 | `_process_qr_scan` | Add composite indexes for queries #8, #10, #11 | Reduce gate scan latency by 50%+ |
| P1 | `_process_qr_scan` | Batch `commit()` calls to end of function | Reduce SQLite disk syncs from 3-5 to 1 per scan |
| P2 | API | Add `offset`/cursor pagination to `GET /api/gate_logs` | Enable clients to page through full history |
| P2 | Exports | Use temp files instead of `BytesIO` for ZIP exports | Reduce peak memory for large QR exports |
| P3 | `_process_qr_scan` | Create a `qr_lookup` table for single-query entity resolution | Reduce worst-case from 7 queries to 1 |
| P3 | Web route | Cache or approximate `COUNT(*)` for gate_logs pagination | Speed up page rendering on large tables |
