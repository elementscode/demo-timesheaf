import { Request, Response, ForbiddenError, sql } from "@elements/app";
import { currentUser } from "#app/shared/services/auth";
import { timeEntries } from "#app/shared/services/entries";
import { isIsoDate, isoDate, weekStart } from "#app/shared/format";
import html, { Person } from "./template";

export default function route(req: Request, res: Response) {
  let me = currentUser();
  let start = weekStart(isIsoDate(req.query.start) ? req.query.start : isoDate(new Date()));
  let userId = typeof req.query.user === "string" && req.query.user ? req.query.user : me.id;

  if (userId !== me.id && me.role !== "admin") {
    throw new ForbiddenError("You can only see your own week.");
  }

  let people = me.role === "admin"
    ? sql<Person>(`select id, name from users order by name`).all()
    : [{ id: me.id, name: me.name }];

  let person = people.find((p) => p.id === userId);

  if (!person) {
    throw new ForbiddenError("No such person.");
  }

  return new html({
    me,
    people,
    person,
    start,
    entries: timeEntries.view({ userId }),
  });
}
