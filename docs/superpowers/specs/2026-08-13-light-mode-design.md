# Light mode support

**Date:** 2026-08-13  
**Status:** Approved design

## Goal

Add light mode alongside the existing dark UI. Default to the OS preference; let the user override with a manual toggle that persists. Toggle lives on the Dashboard header only.

## Current state

- `client/src/index.css` puts a dark slate/blue palette on `:root` only (no `.dark` block).
- Tailwind already uses `darkMode: ["class"]`.
- `next-themes` is in `package.json` but unused; no `ThemeProvider` or toggle.
- Dashboard title uses a hardcoded `from-white` gradient that would fail in light mode.
- Colored node headers with `text-white` stay as-is (readable on both themes).

## Approach

Use existing `next-themes` (no new dependency).

## Architecture

1. **CSS tokens**  
   - `:root` → light shadcn-style HSL tokens (background, foreground, card, primary, muted, border, etc.).  
   - `.dark` → move the current dark values here unchanged.

2. **ThemeProvider**  
   - Wrap the app in `App.tsx` with `next-themes` `ThemeProvider`.  
   - `attribute="class"`, `defaultTheme="system"`, `enableSystem`, persist via storage key.

3. **ThemeToggle**  
   - Small icon button (lucide sun/moon) in the Dashboard header near “New Flow”.  
   - Click sets explicit `light` or `dark` (overrides system until changed).  
   - Not shown on Flow Editor.

4. **Hardcoded color fix**  
   - Replace Dashboard title `from-white` / `to-white/60` with theme-aware tokens (e.g. `from-foreground` / muted variant) so the heading reads in both modes.

## Out of scope

- Theme toggle on Flow Editor or floating control  
- Three-way system/light/dark picker UI  
- Custom branded light palette beyond standard shadcn light tokens  
- Redesigning node chrome colors

## Verification

- With OS set to light: first load is light; toggle → dark and persists across reload.  
- With OS set to dark: first load is dark; toggle → light and persists.  
- Dashboard title readable in both modes.  
- Existing dark look under `.dark` matches today’s appearance.
