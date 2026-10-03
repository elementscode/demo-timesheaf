import { test, equal } from "@elements/app";
import { addDays, clock, duration, hours, money, parseDuration, weekStart } from "#app/shared/format";

test("format", () => {
  test("parses the ways people type a duration", () => {
    equal(parseDuration("1.5"), 5400);
    equal(parseDuration("1:30"), 5400);
    equal(parseDuration("90m"), 5400);
    equal(parseDuration("2h 15m"), 8100);
    equal(parseDuration("2h"), 7200);
    equal(parseDuration(".25"), 900);
    equal(parseDuration(""), null);
    equal(parseDuration("soon"), null);
  });

  test("formats money, hours and clocks", () => {
    equal(money(123450), "$1,234.50");
    equal(hours(5400), "1.5");
    equal(clock(3725), "1:02:05");
    equal(duration(9000), "2h 30m");
    equal(duration(1800), "30m");
  });

  test("weeks start on Monday", () => {
    equal(weekStart("2026-09-30"), "2026-09-28");
    equal(weekStart("2026-09-27"), "2026-09-21");
    equal(addDays("2026-09-28", 6), "2026-10-04");
  });
});
