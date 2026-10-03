import { AuthError, ForbiddenError, session, sql } from "@elements/app";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export interface DemoLogin {
  email: string;
  name: string;
  role: "admin" | "member";
}

/** The seeded accounts. The sign-in page lists the ones that exist. */
export const DEMO_PASSWORD = "timesheaf";

const DEMO_EMAILS = [
  "maya@timesheaf.test",
  "jonah@timesheaf.test",
  "priya@timesheaf.test",
  "theo@timesheaf.test",
];

export function demoLogins(): DemoLogin[] {
  return sql<DemoLogin>(`
    select email, name, role::text as role
      from users
     where email = any(${DEMO_EMAILS})
  order by (role = 'admin') desc, name
  `).all();
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = email.trim().toLowerCase();

  if (!address || !password) {
    throw new AuthError("Enter your email and password.");
  }

  let user = sql<CurrentUser>(`
    select id, name, email, role::text as role
      from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("That email and password do not match.");
  }

  session.login({ userId: user.id, userName: user.name, role: user.role });
}

/** @rpc */
export function signout() {
  session.logout();
}

/** The signed-in user, reread from the table. Throws 401 when signed out. */
export function currentUser(): CurrentUser {
  session.isLoggedInOrThrow();

  let user = sql<CurrentUser>(`
    select id, name, email, role::text as role
      from users
     where id = ${session.getOrThrow("userId")}
  `).first();

  if (!user) {
    session.logout();
    throw new AuthError("Sign in again.");
  }

  return user;
}

export function requireAdmin(): CurrentUser {
  let user = currentUser();

  if (user.role !== "admin") {
    throw new ForbiddenError("Only an admin can do that.");
  }

  return user;
}
