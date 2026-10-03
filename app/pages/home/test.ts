import { test, equal } from "@elements/app";
import { projectOptions } from "#app/shared/services/entries";
import { agency } from "#app/shared/testing/fixtures";
import { sql } from "@elements/app";

test("track page", () => {
  test("offers only open projects, with their client", () => {
    let f = agency();
    sql(`insert into projects (clientId, name, rateCents, archived) values (${f.clientId}, 'Old', 100, true)`);

    let options = projectOptions();
    equal(options.map((p) => p.name), ["Site"]);
    equal(options[0].clientName, "Acme");
  });
});
