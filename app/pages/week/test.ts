import { test, equal } from "@elements/app";
import { weekGrid } from "./template";
import type { Entry } from "#app/shared/services/entries";

function entry(fields: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    userId: "u",
    projectId: "p1",
    workDate: "2026-09-28",
    seconds: 3600,
    startedAt: null,
    note: "",
    billable: true,
    invoiceId: null,
    createdAt: new Date(),
    projectName: "Site",
    projectColor: "#000",
    clientName: "Acme",
    userName: "Mel",
    ...fields,
  };
}

test("week grid", () => {
  test("buckets hours by project and weekday", () => {
    let now = Date.now();
    let grid = weekGrid([
      entry({ workDate: "2026-09-28", seconds: 3600 }),
      entry({ workDate: "2026-09-28", seconds: 1800 }),
      entry({ workDate: "2026-09-30", projectId: "p2", seconds: 7200, billable: false }),
      entry({ workDate: "2026-10-05", seconds: 3600 }),
      entry({ workDate: "2026-10-01", seconds: 0, startedAt: new Date(now - 600_000) }),
    ], "2026-09-28", now);

    equal(grid.rows.length, 2);
    equal(grid.dayTotals[0], 5400);
    equal(grid.dayTotals[2], 7200);
    equal(grid.dayTotals[3], 600);
    equal(grid.total, 13200);
    equal(grid.billable, 6000);
    equal(grid.rows.find((r) => r.id === "p1")!.running[3], true);
  });
});
