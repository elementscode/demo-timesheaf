/**
 * The keys your app stores in the session, so `session.get("userId")` is
 * typed. Role is a display hint for navigation; every guard rereads it from
 * the users table.
 */
declare module "@elements/app" {
  interface SessionData {
    userId: string;
    userName: string;
    role: "admin" | "member";
  }
}

export {};
