# Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light mode with OS-default preference and a Dashboard-only toggle that persists the user's choice.

**Architecture:** Split CSS tokens into light `:root` and dark `.dark` (preserving today's dark values). Wire already-installed `next-themes` via a `ThemeProvider` and a sun/moon `ThemeToggle` on the Dashboard header. Fix the one hardcoded white title gradient.

**Tech Stack:** Vite React SPA, Tailwind `darkMode: ["class"]`, `next-themes@0.4.6`, lucide-react, Playwright for e2e.

## Global Constraints

- No new npm dependencies (`next-themes` and lucide already installed).
- Default theme: `system`; manual override persists light/dark.
- Toggle only on Dashboard (not Flow Editor).
- Dark palette under `.dark` must match current `:root` values exactly.
- Out of scope: 3-way system picker UI, custom light brand palette, editor toggle.

## File map

| File | Responsibility |
|------|----------------|
| `client/src/index.css` | Light tokens on `:root`; current dark tokens under `.dark` |
| `client/index.html` | `suppressHydrationWarning` on `<html>` for class theme |
| `client/src/components/theme-provider.tsx` | Thin `next-themes` wrapper |
| `client/src/App.tsx` | Mount `ThemeProvider` |
| `client/src/components/theme-toggle.tsx` | Sun/moon button using `useTheme` |
| `client/src/pages/Dashboard.tsx` | Place toggle; fix title gradient |
| `scripts/check-theme-css.mjs` | Assert CSS has light `:root` + `.dark` with known dark bg |
| `e2e/theme.spec.ts` | Toggle sets `html.dark` / removes it and persists |

---

### Task 1: CSS light/dark token split

**Files:**
- Modify: `client/src/index.css`
- Create: `scripts/check-theme-css.mjs`
- Test: `scripts/check-theme-css.mjs` (run with `node`)

**Interfaces:**
- Consumes: none
- Produces: `:root` light HSL tokens; `.dark` block with the previous dark values (`--background: 222 47% 11%`, etc.)

- [ ] **Step 1: Write the failing CSS check**

Create `scripts/check-theme-css.mjs`:

```js
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");

const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\}/);
if (!darkBlock) {
  console.error("FAIL: missing .dark { ... } block");
  process.exit(1);
}
if (!darkBlock[1].includes("--background: 222 47% 11%")) {
  console.error("FAIL: .dark must keep --background: 222 47% 11%");
  process.exit(1);
}

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootBlock) {
  console.error("FAIL: missing :root { ... } block");
  process.exit(1);
}
if (rootBlock[1].includes("--background: 222 47% 11%")) {
  console.error("FAIL: :root still has dark background; expected light tokens");
  process.exit(1);
}
if (!rootBlock[1].includes("--background: 0 0% 100%")) {
  console.error("FAIL: :root missing light --background: 0 0% 100%");
  process.exit(1);
}

console.log("OK: theme CSS light :root + dark .dark");
```

- [ ] **Step 2: Run check — expect FAIL**

Run: `node scripts/check-theme-css.mjs`  
Expected: `FAIL: missing .dark { ... } block` (exit 1)

- [ ] **Step 3: Update `client/src/index.css` tokens**

Replace the `:root { ... }` block (keep font vars) so light lives on `:root` and current dark moves under `.dark`. Exact content:

```css
:root {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Light */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;

  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;

  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;

  --primary: 217 91% 60%;
  --primary-foreground: 210 40% 98%;

  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;

  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;

  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 217 91% 60%;

  --radius: 0.5rem;
}

.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;

  --card: 222 47% 11%;
  --card-foreground: 210 40% 98%;

  --popover: 222 47% 11%;
  --popover-foreground: 210 40% 98%;

  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;

  --secondary: 217 33% 17%;
  --secondary-foreground: 210 40% 98%;

  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;

  --accent: 217 33% 17%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 63% 31%;
  --destructive-foreground: 210 40% 98%;

  --border: 217 33% 17%;
  --input: 217 33% 17%;
  --ring: 224 76% 48%;
}
```

Leave the existing `@layer base` and scrollbar rules unchanged.

- [ ] **Step 4: Run check — expect PASS**

Run: `node scripts/check-theme-css.mjs`  
Expected: `OK: theme CSS light :root + dark .dark` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css scripts/check-theme-css.mjs
git commit -m "$(cat <<'EOF'
feat: split CSS into light and dark theme tokens

EOF
)"
```

---

### Task 2: ThemeProvider wiring

**Files:**
- Create: `client/src/components/theme-provider.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/index.html` (`<html>` tag)

**Interfaces:**
- Consumes: `next-themes` `ThemeProvider`
- Produces: `ThemeProvider({ children })` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="nff-theme"`

- [ ] **Step 1: Create `client/src/components/theme-provider.tsx`**

```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="nff-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Wrap App**

In `client/src/App.tsx`, import `ThemeProvider` and wrap inside `QueryClientProvider` (outside `TooltipProvider` is fine):

```tsx
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Suppress hydration warning on `<html>`**

In `client/index.html`, change the opening html tag to:

```html
<html lang="en" suppressHydrationWarning>
```

- [ ] **Step 4: Smoke-check provider mounts**

Run: `pnpm exec tsc --noEmit` (or the project's typecheck if different — if none, skip and rely on Task 3 e2e).  
Expected: no new errors from these files.

If the project has no standalone `tsc` script, run: `pnpm run build` and confirm it succeeds (or note failures unrelated to theme).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/theme-provider.tsx client/src/App.tsx client/index.html
git commit -m "$(cat <<'EOF'
feat: wire next-themes ThemeProvider with system default

EOF
)"
```

---

### Task 3: ThemeToggle on Dashboard + title fix

**Files:**
- Create: `client/src/components/theme-toggle.tsx`
- Modify: `client/src/pages/Dashboard.tsx`
- Create: `e2e/theme.spec.ts`
- Test: `e2e/theme.spec.ts`

**Interfaces:**
- Consumes: `useTheme` from `next-themes`; `Button` from `@/components/ui/button`
- Produces: `ThemeToggle` — ghost icon button; click sets `light` or `dark` from `resolvedTheme`

- [ ] **Step 1: Write failing Playwright test**

Create `e2e/theme.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("theme toggle switches html class and persists", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("nff-theme");
  });

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: /switch to (light|dark) mode/i });
  await expect(toggle).toBeVisible();

  // System light → no .dark on html
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: /switch to light mode/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm exec playwright test e2e/theme.spec.ts`  
Expected: FAIL (toggle button not found)

- [ ] **Step 3: Create `client/src/components/theme-toggle.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Toggle theme" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 4: Wire Dashboard header + fix title**

In `client/src/pages/Dashboard.tsx`:

1. Import `ThemeToggle`.
2. Change the title class from  
   `bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent`  
   to  
   `bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent`.
3. Replace the header actions so toggle sits beside New Flow:

```tsx
<div className="flex items-center gap-2">
  <ThemeToggle />
  <Link href="/editor/new">
    <Button size="lg" className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
      <Plus className="w-5 h-5 mr-2" />
      New Flow
    </Button>
  </Link>
</div>
```

- [ ] **Step 5: Run Playwright — expect PASS**

Run: `pnpm exec playwright test e2e/theme.spec.ts`  
Expected: PASS

Also re-run: `node scripts/check-theme-css.mjs` → OK

- [ ] **Step 6: Commit**

```bash
git add client/src/components/theme-toggle.tsx client/src/pages/Dashboard.tsx e2e/theme.spec.ts
git commit -m "$(cat <<'EOF'
feat: add Dashboard theme toggle and light-safe title

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Light `:root` + dark `.dark` with current dark values | Task 1 |
| `next-themes` ThemeProvider, system default, persist | Task 2 (`storageKey="nff-theme"`) |
| Dashboard-only sun/moon toggle | Task 3 |
| Fix `from-white` title gradient | Task 3 |
| Out of scope items not implemented | — |

No placeholders. Toggle API (`ThemeToggle`, `storageKey="nff-theme"`, aria labels) consistent across Task 2–3 and e2e.
