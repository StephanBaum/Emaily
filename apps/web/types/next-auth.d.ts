import "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    teamId: string;
    teamName: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      teamId: string;
      teamName: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    teamId: string;
    teamName: string;
  }
}
