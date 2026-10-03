import { Request, Response, sql } from "@elements/app";
import { currentUser } from "#app/shared/services/auth";
import { projectOptions, timeEntries } from "#app/shared/services/entries";
import html from "./template";

export default function route(req: Request, res: Response) {
  let me = currentUser();
  let projects = projectOptions();

  let last = sql<{ projectId: string }>(`
      select e.projectId
        from timeEntries e
        join projects p on p.id = e.projectId
       where e.userId = ${me.id} and not p.archived
    order by e.createdAt desc
       limit 1
  `).first();

  return new html({
    me,
    projects,
    own: timeEntries.view({ userId: me.id }),
    team: timeEntries.view(),
    lastProjectId: last?.projectId ?? projects[0]?.id ?? "",
  });
}
