# Review, feat/bubble-up-and-restore, 2026-10-21

**Reviewed by**: claude-opus-5-5 (author on a different session model)
**Scope**: 52 files, branch vs origin/main (merge base 33b0d26, committed plus uncommitted, dist excluded)
**Verdict**: Approve with nits

## Summary
The branch adds the rise entrance (RiseTracker, EntranceGate, least crowded spawn), the popped ledger with `restore(id?)`, `restoreOnNextPop`, and `onOrbRestore`, and moves the pop wiring into `ChartPopHost`. The design follows spec 0006 closely: the rise is a pure draw offset read through one `centerOf`, time always comes from the loop clock, the gate is on the teardown list, and the ledger is cleared by `setData` and `destroy`. I found no blockers or majors. The findings are small edge cases (a double draw on an idle restore then pop, parked bubbles that stay hidden after an option change), a spec text that no longer matches the chosen size budgets, and a few untested paths.

## Minor

### 🟡 An idle activation that restores and pops draws twice, `app/core/PopController.ts:86`
**Problem**: In `activate`, `bring` calls `host.arrive`, which redraws an idle chart (`ChartPopHost.ts:114`). Then `popOne` redraws again (`PopController.ts:126`). On a still chart the first draw also settles.
**Why it matters**: AC-6 says a restore on an idle chart draws once. Two draws per click on a still or paused chart is not visible to users, but it is extra work, and the first frame shows the clicked bubble still present for one draw.
**Suggested fix**: Let `bring` skip the redraw when called from `activate` (for example a flag on `arrive`, or move the idle redraw out of `arrive` into `restore` and `activate`), so the activation draws once at the end, with `settle` true when anything was restored on a still chart.

### 🟡 Parked bubbles stay hidden after `transitionDuration: 0` or `enterStyle: "grow"` arrives by `updateConfig`, `app/core/RiseTracker.ts:58`
**Problem**: Bubbles parked while the gate is closed only leave that state through `release` (gate opens) or `finishAll` (pause or still). If the developer sets `transitionDuration` to 0 or `enterStyle` to `"grow"` with `updateConfig` before the chart is seen, the parked records stay, and `offsetOf` keeps drawing those bubbles fully below the edge.
**Why it matters**: AC-1 and AC-3 say `"grow"` and `transitionDuration: 0` ignore the gate. Today it only works for bubbles that enter after the change. If the container is in a tab or a hidden panel that never intersects, those bubbles stay invisible for good while still being in `getData()` and the hidden list.
**Suggested fix**: When `updateConfig` turns the rise off (duration 0 or grow), release parked bubbles at once (or call `finishAll` and open the gate). Add a test for it.

### 🟡 Spec 0006 AC-16 no longer matches the budgets that shipped, `docs/specs/0006-bubble-up-and-restore/index.md:41`
**Problem**: AC-16 says that if a measured size is over budget, the budgets move to 14, 15, and 14 kB. The branch moved them to 15, 15, and 15 kB (`.size-limit.json`), and only spec 0001 *Revision* records why. Spec 0006 still states the old plan, and AGENTS.md still says 9, 10, and 9 kB.
**Why it matters**: The spec is the contract; a reader of 0006 gets the wrong numbers, and the "React is core plus 1 kB" rule is quietly gone. React now has 0.09 kB of room, so the next change will reopen this anyway.
**Suggested fix**: Amend AC-16 in spec 0006 with a pointer to the 0001 *Revision* (as was done for 0005 AC-3), and let `/sync` update the budgets line in AGENTS.md.

### 🟡 A bubble popped before the container had a size comes back in the corner, `app/core/PopController.ts:110`
**Problem**: The record stores `orb.x` and `orb.y`. For an orb still waiting for a sized container these are 0 and 0. If the container gets a size before `restore`, `Spawner.clamp` puts the bubble at `(r, r)`, the top left corner, instead of a fresh place.
**Why it matters**: Rare (a pop by id on a chart that never had a size), but the result looks like a bug. Restoring while still unsized is fine, since it takes the pending path.
**Suggested fix**: Mark the record as unplaced when the orb was awaiting (the host already knows through `reconciler.awaiting`), and let `restoreOrb` use the spawn path for it.

### 🟡 Untested paths in the new logic
**Problem**: No test covers restore in an unsized container (pending path, then placed on resize), an `updateConfig` that changes `enterStyle` or `transitionDuration` while bubbles are parked, the draw count of an idle activation that restores then pops, or a `restore` while the gate is still closed (the bubble rises at once, unseen).
**Why it matters**: These are the branches where the behavior above slips through, and the spec calls each of them out.
**Suggested fix**: Add one focused test per path in `OrbChart.restore.test.ts` and `OrbChart.rise.test.ts`.

## Nits
- ⚪ `app/renderer/CanvasRenderer.ts:96` and `:164`, `centerOf` and `bubbleOf` default `now` to 0; any caller that forgets it draws a rising bubble fully parked. Make `now` required, since every caller already passes it.
- ⚪ `app/renderer/ChartView.ts` is now 220 lines and `app/core/OrbReconciler.ts` 208, both over the about 200 line rule. Not urgent, but feature 7 is a good moment to split them (for example the restore building step out of the reconciler).
- ⚪ `app/core/OrbChart.restore.test.ts:233`, `expected` is only checked for its length; drop it or compare against it.
- ⚪ `app/core/PopController.ts:135`, `records.reverse()` reverses the caller's array in place. Every caller passes a fresh array today, but `[...records].reverse()` (as `notify` does) removes the trap.
- ⚪ `app/core/ChartPopHost.ts:110`, `restore` while the gate is closed starts the rise at once, so a chart below the fold finishes the rise before it is seen. Acceptable per AC-7, worth one line in the docs.

## Strengths
- The rise is a read only draw offset, and every visible part (draw, hit test, tooltip, focus cue, pop snapshot) goes through one `centerOf`, exactly as AC-5 asks. Physics and `getData()` never see it.
- `EntranceGate` is small, registered on the view teardown, guards late callbacks after dispose, and never calls back from inside the `ChartView` constructor when `IntersectionObserver` is missing.
- Restore radii count live plus popped values, and `retargetAll` does the same, so a full restore matches a fresh `setData` even after `minRadius` or `maxRadius` changes; there is a test proving it.
- One composed live region message per activation (`"A restored, B popped"`) is a careful touch for screen reader users.
- `OrbChart.ts` lands at exactly 285 lines thanks to `ChartPopHost`, and the React side reuses `useLatest` and the existing config diff with no new render time core access.

## Test coverage
Coverage is broad: `RiseTracker`, `PopLedger`, `Spawner`, `EntranceGate`, `ChartPopHost`, and `PopController` each have unit tests with a fixed `random` and a fake clock, and `OrbChart.rise` and `OrbChart.restore` cover the spec's critical scenarios (gate park and release, no replay, pause and still finish, restore order, list index, AC-8 radii, restore on next pop for click, tap, and hidden button, idle restore with no frame queued). React tests cover strict mode with one live observer and unmount before the gate opens, and Playwright covers the real browser rise. Gaps are listed in the last Minor finding: unsized restore, option changes while parked, idle activation draw count, and restore with the gate closed.
