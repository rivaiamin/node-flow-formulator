# Node Flow Formulator

A visual, node-based data processing pipeline editor built with React Flow. Create, edit, and execute data transformation workflows through an intuitive drag-and-drop interface.

## Features

- 🎨 **Visual Flow Editor** - Drag-and-drop interface for building data processing pipelines
- 📊 **Collection node model** - Source, Excel, Filter, Sort, Limit, Group By, Aggregate Groups, Min/Max, Combine by Key, Round, Output
- ⚡ **Shared execution engine** - Same `shared/flow-engine.ts` for the editor and HTTP run API
- 💾 **Persistent Storage** - Save and load flows from PostgreSQL database
- 🎯 **Dashboard** - Manage all your flows from a centralized dashboard
- 🎨 **Modern UI** - Built with shadcn/ui components and Tailwind CSS

## Node Types

### Sources
- **Source** — Named dataset (`data.dataset`) with optional sample JSON; at API run time, supply matching keys under `datasets`
- **Excel Input** — Load a `.xlsx` (stored as base64 on the node); outputs a row array

### Collection
- **Filter** — Field conditions: `==`, `!=`, `>`, `<`, `contains` (lodash `get` paths)
- **Sort** — Order rows by field ascending/descending
- **Limit** — Take the first N rows
- **Group By** — Group rows by a field → `{ key → rows }`
- **Aggregate Groups** — Per-group ops: count, sum, average, min, max, weighted_sum, weighted_average
- **Min / Max (extrema)** — Global min and/or max for a numeric field → scalar map

### Combine / Scalar
- **Combine by Key** — Join two scalar maps (values × weights), e.g. weighted average
- **Round** — Round a scalar to N decimal places

### Output
- **Output** — Terminal node; its value is the flow’s `finalOutput` (and HTTP API `output`)

Legacy node types (`inputNode`, `filterNode`, `groupNode`, `statsNode`, `resultNode`) still execute for old saved flows.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Flow** - Node-based editor
- **shadcn/ui** - UI component library
- **Tailwind CSS** - Styling
- **Wouter** - Lightweight routing
- **TanStack Query** - Data fetching and caching
- **Framer Motion** - Animations

### Backend
- **Express.js** - Web server
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe database queries
- **Zod** - Schema validation

### Build Tools
- **Vite** - Build tool and dev server
- **TypeScript** - Type checking
- **ESBuild** - Fast bundling

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd node-flow-formulator
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PORT=5000
NODE_ENV=development
```

4. Set up the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

## Project Structure

```
node-flow-formulator/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── flow/      # Flow editor components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── pages/         # Page components
│   └── index.html
├── server/                # Backend Express server
│   ├── db.ts             # Database connection
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   └── static.ts         # Static file serving
├── shared/               # Shared code between client/server
│   ├── flow-engine.ts    # Flow execution (used by UI and POST /api/flows/:id/run)
│   ├── routes.ts         # Shared route definitions
│   └── schema.ts         # Database schema
└── package.json
```

## How It Works

1. **Creating a Flow**: Start by creating a new flow from the dashboard
2. **Building the Pipeline**: Drag nodes from the sidebar onto the canvas
3. **Connecting Nodes**: Connect nodes by dragging from output handles to input handles
4. **Configuring Nodes**: Click on nodes to configure their parameters (fields, operators, etc.)
5. **Running the Flow**: Click "Run Flow" to execute the pipeline and see data flow through nodes
6. **Saving**: Save your flow to persist it in the database

## Flow Execution

The flow execution engine uses a topological sort algorithm to determine the execution order:

1. Identifies root nodes (Input nodes or nodes with no incoming edges)
2. Processes nodes in dependency order using BFS
3. Each node receives data from its parent nodes
4. Node-specific logic processes the data
5. Results are stored and passed to child nodes
6. Errors are caught and displayed on the respective nodes

## Run a flow via HTTP API

Runs use the same engine as **Run Flow** in the editor (`shared/flow-engine.ts`).

### Optional `datasets` (collection / multi-source)

Collection flows use named **Source** nodes (`data.dataset`). Pass matching keys under **`datasets`** so each source receives its own payload:

```json
{
  "datasets": {
    "score_inputs": [ { "type": "Tugas", "score_eff": 80, "w_peng": 1 } ],
    "pct_pengetahuan": { "Tugas": 25, "Ulangan": 25 }
  }
}
```

If a source’s dataset key is missing from `datasets`, that node falls back to its saved sample `data.json` (same as the editor).

### Optional `input` (legacy single-source)

- If the body includes **`input`**, that value is fed into every **Input** / unbound **Source** node for that run (it overrides stored JSON for this execution only). Prefer **`datasets`** for multi-source flows.
- If you **omit** both `input` and `datasets` (or send `{}`), sources use their **saved** sample JSON, same as in the UI.

### Run by flow id

```http
POST /api/flows/:id/run
Content-Type: application/json
```

```json
{
  "input": [ { "name": "Ada", "score": 95 } ]
}
```

Or, for collection flows with named Source nodes:

```json
{
  "datasets": {
    "score_inputs": [ { "type": "Tugas", "score_eff": 80, "w_peng": 1 } ],
    "pct_pengetahuan": { "Tugas": 25, "Ulangan": 25 }
  }
}
```

Omit both to rely on stored sample JSON:

```json
{}
```

**Success (200):**

```json
{
  "output": [ ... ]
}
```

`output` is the data at the last **Result** node in execution order (or the last node’s output if there is no Result node).

### Run by flow name

```http
POST /api/flows/run
Content-Type: application/json
```

```json
{
  "flowName": "My pipeline",
  "input": [ { "x": 1 } ]
}
```

**Success (200):** same as run-by-id, plus **`flowId`** so callers know which row ran.

If **more than one** saved flow has the same `name`, the server responds with **409 Conflict**—use run-by-id or rename flows so names are unique.

### HTTP status summary

| Status | Meaning |
|--------|---------|
| 200 | Run finished without node errors |
| 400 | Invalid JSON body / validation |
| 401 | API key required but missing or wrong (see below) |
| 404 | Flow not found (id or name) |
| 409 | Run by name only: multiple flows share that name |
| 422 | Graph invalid or a node reported an error; may include `output`, `nodeErrors`, and for run-by-name `flowId` |

### Protecting run endpoints (`FLOW_RUN_API_KEY`)

Set **`FLOW_RUN_API_KEY`** in the environment to require authentication on **`POST /api/flows/:id/run`** and **`POST /api/flows/run`** only.

Clients must send either:

- `Authorization: Bearer <FLOW_RUN_API_KEY>`, or  
- `X-API-Key: <FLOW_RUN_API_KEY>`

If **`FLOW_RUN_API_KEY` is unset**, run endpoints stay **open** (typical for local development). Other routes (`GET`/`POST`/`PUT`/`DELETE` flows CRUD) are unchanged.

### Execution with node errors (422)

One or more nodes failed (e.g. invalid JSON in an Input node). Response includes `message`, optional `output`, optional `flowId` (run-by-name), and `nodeErrors` (map of node id → error message).

## Excel source node (local file)

The **Excel Input** node lets you start a pipeline from a local `.xlsx` file. It stores the workbook in the flow as **base64** and parses it at runtime via the shared engine.

- **Fields**: file, sheet name, “header row” toggle
- **Output**: array of row objects (same shape as JSON Input output)
  - If header row is enabled: keys come from the first row
  - If header row is disabled: keys are Excel column letters (`A`, `B`, `C`, ...)

## Database Schema

The application uses a single `flows` table:

```typescript
{
  id: number (serial)
  name: string
  flowData: JSONB (stores nodes and edges)
  createdAt: timestamp
}
```

## Development

### Adding New Node Types

1. Create a new node component in `client/src/components/flow/NodeTypes.tsx`
2. Add the node type to the `nodeTypes` export
3. Implement the processing logic in `shared/flow-engine.ts` (the client’s `client/src/lib/flow-utils.ts` wraps the same `executeFlow` function)
4. Add the node to the sidebar in `client/src/components/flow/FlowSidebar.tsx`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

