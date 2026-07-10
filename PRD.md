# Product Requirements Document (PRD)

**Product:** Node Flow Formulator  
**Version:** 1.3 (flow run API follow-ups: name lookup, optional input, API key)  
**Last updated:** April 19, 2026  
**Source:** Derived from `readme.md` and product intent

---

## 1. Executive summary

Node Flow Formulator is a web application for building, running, and persisting **visual data-processing pipelines**. Users compose workflows on a canvas (React Flow), connect nodes that transform JSON-like data, execute flows in real time, and save definitions to PostgreSQL. The product targets analysts, developers, and technical operators who need repeatable, inspectable data transforms without writing scripts for every task.

**Planned:** A **programmatic HTTP API** to run a saved flow by identifier (name or id) with caller-supplied input JSON and receive the processed output—enabling integrations, scripts, and other services to reuse flows without the UI.

---

## 2. Problem statement

**Problem:** Ad-hoc data filtering, grouping, and aggregation often requires custom scripts or spreadsheets, which are hard to reuse, share, and audit.

**Solution:** A **node-based flow editor** with a small set of composable node types, **deterministic execution order** (topological / BFS-style processing), and **server-side persistence** so flows become reusable assets.

---

## 3. Product vision

Enable users to **design, execute, and store** data pipelines through an intuitive visual interface, with clear feedback at each step and a path to extend processing capabilities over time.

**Planned direction:** Add **multiple source nodes** (beyond paste JSON)—notably **Excel** and **HTTP API**—so pipelines can start from real-world inputs. Add **processing nodes** for common tabular operations such as **sort**, **min**, and **max** (alongside existing statistics), keeping behavior consistent with the current execution model. Add a **server-side flow execution API** so clients can `POST` input data + flow reference and receive the **same logical output** as running the flow in the app (see §6.7).

---

## 4. Goals and non-goals

### 4.1 Goals (current product)

| ID | Goal |
|----|------|
| G1 | Let users create and edit flows via drag-and-drop on a canvas. |
| G2 | Support a defined set of node types: Input, Filter, Group By, Statistics, Result. |
| G3 | Execute flows and show data propagation and errors on nodes. |
| G4 | Persist flows (name + graph JSON) in PostgreSQL and manage them from a dashboard. |
| G5 | Provide a modern, consistent UI (shadcn/ui, Tailwind). |

### 4.2 Non-goals (explicitly out of scope for v1 baseline)

- Multi-tenant auth, roles, and org-wide permissions (not described in baseline).
- Distributed or streaming execution at scale (single-flow, in-app execution model).
- Arbitrary code execution or plug-in marketplace (only built-in node types).
- Full ETL/data-warehouse integration (baseline has no warehouse connectors; **Excel/API source nodes** are planned as scoped inputs, not a full integration platform).

*Non-goals may move into scope in later phases; see §9.*

### 4.3 Planned goals (post-baseline; not yet fully specified in code)

| ID | Goal |
|----|------|
| G6 | Support an **Excel source** node: user provides a workbook (e.g. `.xlsx`), selects sheet and options, output normalized to the same JSON-array shape the rest of the pipeline expects. |
| G7 | Support an **API source** node: configurable HTTP request (method, URL, headers/query/body as appropriate), parse JSON response into pipeline data, with clear error handling for non-JSON or HTTP errors. |
| G8 | Support a **Sort** node: order rows by one or more field paths, ascending/descending per key. |
| G9 | Support **Min** and **Max** (or a single **Min/Max** node with operation selector): compute minimum/maximum for a numeric field—globally on an array, or per group if combined with Group By (see §6.6). |
| G10 | Keep **source nodes** visually and logically consistent: multiple roots allowed only where the execution model defines merge semantics, or restrict to one active source per flow until merge behavior exists. |
| G11 | Expose a **REST (or RPC) API** to **execute a persisted flow** by **flow id** and/or **unique name**, accepting **input payload** (JSON) that feeds the pipeline’s entry (e.g. Input node or designated root), and returning **output data** (and structured errors on failure). |
| G12 | Ensure **API execution semantics** match the in-app engine (same node order and transforms) by running a **shared execution module** on the server—avoid two diverging implementations. |

---

## 5. Target users and use cases

### 5.1 Primary personas

- **Technical analyst:** Builds quick pipelines to filter/group/summarize JSON exports; needs clarity and repeatability.
- **Application developer:** Prototypes transformation logic visually before coding; saves flows for demos or fixtures.
- **Power user / operator:** Maintains a library of named flows for recurring reports.
- **Integrator / backend developer** *(planned API):* Calls an HTTP endpoint from jobs, apps, or ETL tools to run a named flow on JSON payloads and consume the result.

### 5.2 Representative use cases

1. Paste or load JSON, filter rows by field conditions, aggregate counts/sums/averages, inspect results in a table.
2. Group records by a key, then compute statistics per group.
3. Save a flow, return later from the dashboard, tweak parameters, re-run.
4. Share flow *definitions* (via export or DB backup—future enhancement if not present).
5. *(Planned)* Start from an **Excel** file or an **API** endpoint instead of raw JSON only.
6. *(Planned)* **Sort** a dataset by columns; find **min**/**max** values for reporting or downstream filters.
7. *(Planned)* **Invoke a saved flow via API:** send `flowName` or `flowId` plus input JSON; receive processed output for use in another system or script.

---

## 6. Functional requirements

### 6.1 Flow authoring

| ID | Requirement | Notes (from product) |
|----|-------------|----------------------|
| FR-A1 | Users can add nodes from a palette/sidebar to the canvas. | Visual flow editor |
| FR-A2 | Users can connect nodes via edges (outputs → inputs). | React Flow |
| FR-A3 | Users can configure each node (fields, operators, paths). | e.g. Filter: `==`, `!=`, `>`, `<`, `contains`; lodash `get` paths |
| FR-A4 | Input node accepts and validates JSON as pipeline entry. | Input node |
| FR-A5 | Result node shows tabular preview (e.g. up to 10 rows) and record count. | Result node |

### 6.2 Flow execution

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-E1 | Execution order respects dependencies (roots → downstream). | Topological sort + BFS per readme |
| FR-E2 | Each node receives merged/forwarded data from parents per engine rules. | Described in readme |
| FR-E3 | Errors are surfaced on the relevant node(s). | Per readme |
| FR-E4 | “Run Flow” triggers execution and updates UI with propagated data. | Real-time execution |

### 6.3 Node behaviors (summary)

- **Input:** Parse/validate JSON; pipeline start.
- **Filter:** Conditions on field paths; supported operators as listed in readme.
- **Group By:** Group by field; include counts.
- **Statistics:** Count, Sum, Average on flat or grouped data; nested paths.
- **Result:** Final display; scrollable table; sample size + total count.

### 6.4 Persistence and dashboard

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-P1 | Flows are stored with id, name, `flowData` (JSONB: nodes + edges), `createdAt`. | Single `flows` table |
| FR-P2 | Users can list/manage flows from a centralized dashboard. | Dashboard feature |
| FR-P3 | Users can load a saved flow into the editor. | Implied by save/load |

### 6.5 Platform and quality

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-Q1 | API validation using Zod; type-safe DB access via Drizzle. | Backend stack |
| FR-Q2 | Client routing via Wouter; server API + static client in dev/prod as implemented. | Stack |

### 6.6 Planned: additional source and processing nodes

Requirements below are **planned**; implementation order follows §9.

#### Source nodes

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-S1 | **Excel source:** User can upload or select a file; choose worksheet; optional header row; map to an array of row objects (column keys from headers or letters). | May require **client-side** parsing (e.g. SheetJS) or a **small server endpoint** for upload/parse—decide based on file size and security policy. |
| FR-S2 | **Excel source:** Validate file type and surface parse errors on the node (corrupt file, empty sheet). | |
| FR-S3 | **API source:** Configure URL, HTTP method, optional query params, headers, and body template; execute on “Run Flow”; treat successful JSON array/object as pipeline input. | Secrets (API keys) should not be hard-coded in saved flow JSON long-term—use env-backed placeholders or Phase C auth (see open questions). |
| FR-S4 | **API source:** Handle timeouts, HTTP error status, and non-JSON responses with actionable messages on the node. | |

#### Processing nodes

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-T1 | **Sort:** Configure sort keys as ordered list of `{ fieldPath, direction }`; stable sort preferred for equal keys. | Works on array of objects; nested paths consistent with existing `get`-style paths. |
| FR-T2 | **Min / Max:** For a chosen numeric field path, output **global** min and/or max (and optionally which record(s) achieved it—product decision). | Can extend **Statistics** node UX or be standalone nodes for clarity. |
| FR-T3 | **Min / Max with grouped data:** If input is grouped (from Group By), compute min/max **per group** when configured. | Aligns with how Count/Sum/Average apply to grouped vs flat data today. |

### 6.7 Planned: programmatic flow execution API

These requirements support **G11** and **G12**. They assume flows are **loaded from the database** and executed **on the server** using logic shared with (or extracted from) the client engine.

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-X1 | **Endpoints:** `POST /api/flows/:id/run` (body: optional `input`) and `POST /api/flows/run` (body: `flowName`, optional `input`). | **Implemented.** Run-by-name returns **`flowId`** on success. **409** if more than one flow shares the same name (caller must use id or rename). |
| FR-X2 | **Request body:** Caller may supply **`input`** JSON that overrides **Input** node data for that run; if **`input` is omitted**, Input nodes use **saved** `data.json` (same as UI). | **Implemented:** optional `input` on both run endpoints. Multiple **Input** nodes each receive the same override when provided. |
| FR-X3 | **Response:** `200` with JSON body containing **final output** (e.g. Result node payload or last stage output) and optional **metadata** (execution time, record count). | Shape should be stable and versioned if breaking changes are expected later. |
| FR-X4 | **Errors:** Invalid flow id/name, missing flow, validation errors, or execution failures return appropriate **HTTP status codes** and a **structured error body** (message, optional node id / stage). | Align with Zod validation patterns already on the server. |
| FR-X5 | **Auth:** Run routes support optional env **`FLOW_RUN_API_KEY`**: when set, require **`Authorization: Bearer`** or **`X-API-Key`**. Other CRUD routes unchanged. | **Implemented** for run endpoints only. Full **per-user API keys** or OAuth for machine clients fit **Phase C**. |
| FR-X6 | **Limits:** Document max request/response body size and optional timeout; return `413`/`504` or JSON error as appropriate. | Prevents abuse and runaway memory use. |
| FR-X7 | **Implementation:** **Extract or duplicate** the execution engine is not acceptable long-term—**share** `flow-utils` (or equivalent) between client and server via `shared/` so UI runs and API runs stay consistent (**G12**). | Server-side execution is a **prerequisite** for this API; the browser-only engine alone cannot satisfy FR-X1–X4 securely for untrusted callers. |

**Rationale (product):** A run-by-name/id API turns saved flows into **reusable backend transforms**, supports **automation**, and pairs naturally with **auth and rate limiting** for production. It requires **one canonical execution path** on the server to avoid drift from the editor’s “Run Flow” behavior.

---

## 7. Technical architecture (summary)

Aligned with `readme.md`:

- **Client:** React 18, TypeScript, React Flow, TanStack Query, Wouter, shadcn/ui, Tailwind, Framer Motion, Vite.
- **Server:** Express, PostgreSQL, Drizzle, Zod.
- **Shared:** Route definitions and DB schema between client and server.

Execution is **client-orchestrated** per readme (flow engine, topological sort); storage is **server-side PostgreSQL**. **Planned:** Move or mirror the **execution engine** into **`shared/`** (or a package consumed by both client and server) so **REST execution** (§6.7) uses the same code path as the UI.

---

## 8. Success metrics (suggested)

| Metric | Description |
|--------|-------------|
| Activation | User creates and runs a flow with ≥2 non-input nodes within first session. |
| Retention | User returns and opens a saved flow within 7 days. |
| Reliability | Run success rate for valid graphs; error messages actionable on failure. |
| Performance | Interactive canvas and run completion within acceptable latency for typical JSON sizes (define SLOs per phase). |
| Source adoption *(planned)* | Flows that use Excel or API sources complete successfully under documented limits (file size, response size). |
| API usage *(planned)* | Successful `POST` run rate; latency p95 within SLO; error rate by category (validation vs execution). |

---

## 9. Future development plan

Roadmap items are **prioritized suggestions** based on gaps between an enterprise-ready pipeline tool and the current baseline. Phases can be adjusted.

### Phase A — Product polish and trust (near term)

- **Undo/redo** and **autosave** (or debounced save) to reduce data loss.
- **Clear empty/error states** on dashboard and canvas.
- **Export/import flow JSON** for backup and sharing without DB access.
- **Rename/delete flows** from dashboard if not already complete; confirm destructive actions.
- **Keyboard accessibility** basics for canvas and dialogs (WCAG-oriented).

### Phase B — Additional sources (Excel, API)

- **Excel source node** (FR-S1, FR-S2): upload/select `.xlsx`, pick sheet, header options, normalize to JSON rows; document max file size and browser vs server parsing.
- **API source node** (FR-S3, FR-S4): HTTP client configuration, JSON parsing, timeout and error UX; align with optional **server-side proxy** later if CORS or secrets become an issue.
- Decide **multi-source flows**: single source per run vs explicit **Merge** node (ties to G10); document in UX.

### Phase B2 — Processing: sort, extrema, and limits

- **Sort node** (FR-T1): multi-key ascending/descending.
- **Min and Max** (FR-T2, FR-T3): either new node types or extensions to **Statistics**—global and per-group behavior must match existing grouped-data patterns.
- **Limit** / **Take N** node (truncate rows for preview or downstream cost).
- Additional **Filter** operators (ranges, regex, `in` list, null checks).
- **Join/Merge** two branches (requires clear semantics for multiple parents)—may follow after Sort/Limit stabilize.

### Phase B3 — Result presentation

- Larger **result sets**: pagination or virtualized table; optional **download CSV/JSON**.

### Phase C — Collaboration and security

- **Authentication** (e.g. session or OAuth) and **per-user flows** (schema: `userId` on `flows`).
- Optional **teams/workspaces** and **role-based access** (view vs edit).
- **Audit log** of saves and runs (lightweight: who/when/what).

### Phase D — Server execution, flow run API, and integration

- **Shared execution engine** on the server (same semantics as UI)—prerequisite for programmatic API (**FR-X7**, **G12**).
- **Flow execution REST API** (**FR-X1–X6**): e.g. `POST` with `flowId` or unique `flowName` + `input` JSON; return output JSON; document limits and error contract.
- **Security for public API:** API key or similar until Phase C; then per-tenant keys or OAuth client credentials (**FR-X5**).
- **Server-side execution** also benefits heavy payloads, **Excel parsing**, large upstream API responses, and secret handling (data never needs to hit the browser).
- **Scheduled runs** or **webhook triggers** (batch-oriented)—can call the same run endpoint internally.
- Additional **connectors** (e.g. file storage **S3**, scheduled **REST** pulls) as further source node variants once Excel/API patterns are proven.

*Dependency note:* Phase D’s API is **easier to ship** once flow graphs have a **single clear input injection point** for `input` (see **FR-X2**); otherwise define explicit rules for multi-root flows first.

### Phase E — Extensibility

- **Plugin or scripted node** (sandboxed JS expression or WASM) with strict limits.
- **Templates** library (e.g. “dedupe + group + sum”) from gallery.
- **Versioning** of flow definitions (history, diff, rollback).

---

## 10. Open questions

1. Maximum supported JSON size and concurrent runs—what are the official limits?
2. Should execution be reproducible with fixed seeds for any randomness (if introduced later)?
3. Is multi-user isolation required before any public deployment?
4. **Excel:** Client-only parsing vs upload to server—tradeoffs for memory, privacy, and max file size?
5. **API source:** Store secrets in flow JSON (discouraged), environment variables only, or a small secrets UI after Phase C?
6. **Min/Max:** Prefer extending the existing **Statistics** node vs separate **Min** / **Max** nodes for simpler sidebar taxonomy?
7. **Run API:** Resolve flow by **numeric id only** vs **unique name**—if name, enforce uniqueness in DB or return `409` on ambiguity?
8. **Run API:** **Synchronous only** (HTTP request holds until done) vs **202 + job id** for long runs—what is the max allowed duration?
9. **Run API:** Should **idempotent** replays (same input + flow version) be supported for caching or audit?

---

## 11. References

- Project overview and technical details: `readme.md`
- Implementation hooks for new nodes: `readme.md` → Development → Adding New Node Types

---

## 12. Product note — programmatic API (why include it)

Exposing **run flow by id/name + input JSON** is a strong fit because: (1) **reuse**—flows become callable transforms, not only UI artifacts; (2) **consistency**—forcing **one shared engine** with the editor avoids subtle bugs between “Run in app” and “Run via API”; (3) **path to product**—pairs with **auth, quotas, and observability** for serious deployments. The main cost is **engineering**: refactor execution into **shared/server code**, define **input binding** for API calls, and add **authentication and limits** before any public endpoint.

---

*This PRD describes the product as documented at baseline plus planned sources (Excel, API), processing nodes (Sort, Min/Max, Limit), and a programmatic **flow run** HTTP API; update sections when shipped behavior or scope changes.*
