import { test, equal } from "@elements/app";
import { buildReport } from "./services";
import { agency, addEntry } from "#app/shared/testing/fixtures";

test("reports", () => {
  test("sums hours and billable amount three ways", () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    addEntry(f.otherId, f.projectId, "2026-09-03", 1800, false);
    addEntry(f.memberId, f.projectId, "2026-10-01", 3600);

    let report = buildReport("2026-09-01", "2026-09-30");

    equal(report.totals.seconds, 5400);
    equal(report.totals.billableSeconds, 3600);
    equal(report.totals.amountCents, 12000);
    equal(report.unbilledCents, 12000);
    equal(report.clients.length, 1);
    equal(report.people.length, 2);
    equal(report.people.find((p) => p.id === f.otherId)!.amountCents, 0);
  });
});
