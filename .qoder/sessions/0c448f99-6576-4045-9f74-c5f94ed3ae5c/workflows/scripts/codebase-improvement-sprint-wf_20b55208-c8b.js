export const meta = {
  name: 'codebase-improvement-sprint',
  description: 'Run 5 rounds of 3 parallel improvement tracks: scanning refactor, security audit, performance/Docker',
  phases: [
    { title: 'Round 1', detail: 'Scanning extraction, security audit, performance baseline' },
    { title: 'Round 2', detail: 'Service layer, CSRF hardening, query optimization' },
    { title: 'Round 3', detail: 'Scan helpers, API key audit, caching' },
    { title: 'Round 4', detail: 'Integration tests, subprocess audit, Docker build' },
    { title: 'Round 5', detail: 'Final verification, rate limiting, Docker test' },
  ],
}

const roundTasks = [
  // Round 1
  [
    'Extract _process_qr_scan() from app.py into services/scan_service.py. Break it into focused helpers: _normalize_qr_hash(), _lookup_employee_by_qr(), _lookup_entity(), _determine_access(), _handle_denial(), _record_gate_log(). Main process_qr_scan() should become a ~50-line orchestrator. Verify with: PYTHONPATH=/home/timothy/Desktop/Control-Access venv/bin/pytest tests/ -q. All 224 tests must still pass.',
    'Perform security audit on the Control-Access Flask app. Check: (1) CSRF configuration - verify /api/ exemption is correct, (2) API key handling - if HARDWARE_API_KEY not set auth is silently disabled (production risk), (3) SQL injection - verify raw SQL in database.py inline migrations, (4) subprocess usage - check for shell injection. Document findings in docs/SECURITY_AUDIT.md with severity ratings.',
    'Profile performance of the Control-Access app. (1) Check if _process_qr_scan() makes sequential DB queries - document which could use eager loading. (2) Verify gate_logs route has pagination. (3) Check if export functions generate full Excel/PDF in memory - document streaming opportunities. Write findings to docs/PERFORMANCE_PROFILE.md.',
  ],
  // Round 2
  [
    'Continue scanning service layer extraction. Create routes/scanning.py blueprint with routes: /qr_scanner, /scan/<qr_hash>, /s/<qr_hash>, /api/scan_qr, /api/scan_alt, /api/scan, /api/scan_rfid, /api/verify-qr. Register in app.py. Update template url_for() calls. Verify: PYTHONPATH=/home/timothy/Desktop/Control-Access venv/bin/pytest tests/ -q must show 224 passed.',
    'Implement security fixes from audit. (1) Add warning log if HARDWARE_API_KEY is not set at startup. (2) Review CSRF exemption pattern for /api/ routes. (3) Check all raw SQL in database.py for injection vectors. Apply fixes directly to the code. Run tests after each fix.',
    'Implement performance improvements. (1) Add eager loading to QR scan queries where N+1 patterns exist. (2) Verify and fix pagination on gate_logs if missing. (3) For any export function loading full datasets, add a comment noting streaming opportunity. Run tests: PYTHONPATH=/home/timothy/Desktop/Control-Access venv/bin/pytest tests/ -q',
  ],
  // Round 3
  [
    'Finalize scanning blueprint. Move generate_qr routes (/generate_qr/<entity_type>/<int:entity_id>, /generate_qr_page) into routes/scanning.py. Update all template references. Run full test suite. Ensure no regressions.',
    'Audit and harden authentication. (1) Check session lifetime configuration. (2) Verify password migration logic (plain-text to hash). (3) Review rate limiting on login (memory:// resets on restart - document risk). (4) Check if legacy password support can be removed. Apply any safe fixes.',
    'Add response caching for read-heavy endpoints. (1) Cache /api/dashboard/stats_history more aggressively if safe. (2) Check if /api/monitoring/stats could benefit from caching. (3) Document cache invalidation strategy. Run tests after changes.',
  ],
  // Round 4
  [
    'Add integration tests for the scanning blueprint. Create tests/test_scanning.py with tests for: valid QR scan, invalid QR hash, expired employee, vehicle scan, visitor scan. Follow existing test patterns in tests/test_qr_scan.py. Run: PYTHONPATH=/home/timothy/Desktop/Control-Access venv/bin/pytest tests/test_scanning.py -v',
    'Audit subprocess and file operations for security. (1) Search app.py and all routes/ for subprocess calls - check for shell=True or unsanitized input. (2) Check file upload/download paths for directory traversal. (3) Verify backup download route is safe. Fix any issues found.',
    'Test Docker build. Run: docker build -t control-access . (if docker available). Verify the build succeeds and routes/ package is included. If docker not available, verify Dockerfile includes routes/ in COPY commands and gunicorn can import app:app correctly.',
  ],
  // Round 5
  [
    'Final scanning verification. Run full test suite. Run ruff check on routes/scanning.py and services/scan_service.py. Ensure all linting passes. Count final app.py line count and report reduction from original 7,755 lines.',
    'Final security verification. Re-run ruff check on entire codebase. Verify no new security issues introduced. Update docs/SECURITY_AUDIT.md with resolution status for each finding.',
    'Final performance and documentation update. Run full test suite one last time. Update AGENTS.md and README.md with accurate line counts, blueprint list, and current architecture. Report final metrics: app.py lines, number of blueprints, test pass count.',
  ],
]

for (let round = 0; round < 5; round++) {
  phase(`Round ${round + 1}`)
  const tasks = roundTasks[round]
  
  const results = await parallel([
    () => agent(tasks[0], { label: `Track-A Round ${round + 1}`, phase: `Round ${round + 1}` }),
    () => agent(tasks[1], { label: `Track-B Round ${round + 1}`, phase: `Round ${round + 1}` }),
    () => agent(tasks[2], { label: `Track-C Round ${round + 1}`, phase: `Round ${round + 1}` }),
  ])
  
  log(`Round ${round + 1} complete. Track A: ${results[0] ? 'done' : 'null'}, Track B: ${results[1] ? 'done' : 'null'}, Track C: ${results[2] ? 'done' : 'null'}`)
}

log('All 5 rounds complete. 15 agent tasks executed across 3 persistent tracks.')
