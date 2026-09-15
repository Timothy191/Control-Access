# E2E Test Infra: Control-Access Platform

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived from `ORIGINAL_REQUEST.md` and user-facing specifications without dependence on internal module shortcuts.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory Coverage
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | Workforce & Contractor Register | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Personal Vehicles (License Disc/Roadworthy) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Heavy Fleet (ID, Hours, Operator Certs) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Equipment & Radios (Gas monitors, RFID, Barcode) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 5 | Gate Scan Expiry Evaluation (Medical/Induction) | ORIGINAL_REQUEST §R1, AC | 5 | 5 | ✓ |
| 6 | Zero-Touch Onboarding QR Generator | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 7 | Dual-Surface Scanner (PWA Camera Fallback & Intents) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Resilient Remote Link (SSE/Tunnel/Offline state) | ORIGINAL_REQUEST §R2, AC | 5 | 5 | ✓ |
| 9 | Key Control Dual-Scan State Machine (30s timeout) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 10 | Key Control Compliance Check (Authorization/Medical/Induction) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 11 | Push Notifications & Visual Strobe (Granted/Denied) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 12 | CSS Industrial Glove Constraints (48x48px, Kiosk) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: TypeScript executable test suite (`tests/e2e/runner.ts`) driven by `pnpm test`.
- Exit code semantics: Exit 0 on 100% pass, exit 1 on any failure.
- Test suites directory: `tests/e2e/`
  - `tests/e2e/tier1-feature-coverage.test.ts`
  - `tests/e2e/tier2-boundary-corner.test.ts`
  - `tests/e2e/tier3-pairwise-combinations.test.ts`
  - `tests/e2e/tier4-application-scenarios.test.ts`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Normal Shift Change Ingress | Employee badge scan, vehicle disc valid, gate opens, audit log recorded | Medium |
| 2 | Expired Medical Contractor Ingress | Contractor badge scanned with expired medical -> immediate red denial alert with exact reason | High |
| 3 | Heavy Hauler Key Checkout Workflow | Cat 797F key scanned -> 30s countdown -> Certified operator badge scanned -> Green access granted + audit checkout | High |
| 4 | Non-Certified Operator Key Checkout Attempt | Excavator key scanned -> Uncertified employee badge scanned -> Immediate red strobe refusal "Machine Authorization Required" | High |
| 5 | Scanner Zero-Touch Provisioning & Tunnel Fallback | QR scan onboard device -> receive tokens and gate profile -> connect SSE -> simulate network drop and offline indicators | High |
| 6 | Expired Safety Induction Vehicle Gate Entry | Driver badge expired safety induction -> gate barrier blocked -> supervisor notification | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (60 tests)
- Tier 2: ≥5 per feature (60 tests)
- Tier 3: Pairwise coverage across feature interactions (12 tests)
- Tier 4: ≥6 realistic industrial mine site operational scenarios
- Total Target: ≥138 automated test cases
