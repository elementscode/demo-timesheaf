import { test, equal, session } from "@elements/app";
import { signin } from "#app/shared/services/auth";
import { agency } from "#app/shared/testing/fixtures";

test("signin", () => {
  test("signs in with the right password", () => {
    agency();
    signin("MEM@test.test ", "timesheaf");

    equal(session.isLoggedIn(), true);
    equal(session.get("role"), "member");
  });

  test("refuses a wrong password without saying which part was wrong", () => {
    agency();
    let message = "";

    try {
      signin("mem@test.test", "nope");
    } catch (err: any) {
      message = err.message;
    }

    equal(message, "That email and password do not match.");
    equal(session.isLoggedIn(), false);
  });
});
