import { test, equal } from "@elements/app";
import { projectOptions } from "#app/shared/services/entries";
import { agency } from "#app/shared/testing/fixtures";
import { sql } from "@elements/app";

test("track page", () => {
  test("offers only open projects, with their client", () => {
    let f = agency();
    let oldId = sql<{ id: string }>(`
      insert into projects (clientId, name, rateCents, archived) values (${f.clientId}, 'Old', 100, true) returning id
    `).firstOrThrow().id;

    let options = projectOptions();
    let acme = options.filter((p) => p.clientName === "Acme");

    equal(acme.map((p) => p.name), ["Site"]);
    equal(acme[0].id, f.projectId);
    equal(options.some((p) => p.id === oldId), false);
  });
});
