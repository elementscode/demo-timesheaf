import { test, equal } from "@elements/app";
import { addProject, parseRate, setRate } from "./services";
import { agency, signInAs } from "#app/shared/testing/fixtures";

test("clients", () => {
  test("reads rates as people type them", () => {
    equal(parseRate("150"), 15000);
    equal(parseRate("$142.50"), 14250);
    equal(parseRate("1,200"), 120000);
  });

  test("an admin adds a project and changes its rate", () => {
    let f = agency();
    signInAs(f.adminId, "admin");

    let clients = addProject({ clientId: f.clientId, name: "Logo", rate: "95", color: "#123456" });
    let logo = clients[0].projects.find((p) => p.name === "Logo")!;
    equal(logo.rateCents, 9500);

    clients = setRate(logo.id, "110");
    equal(clients[0].projects.find((p) => p.name === "Logo")!.rateCents, 11000);
  });
});
