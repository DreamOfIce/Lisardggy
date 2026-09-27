import Schema from "schemastery";

import { Profile } from "../profile";
import { User } from "../user";

export namespace AuthServer {
  export namespace Authenticate {
    export interface Body {
      username: string;
      password: string;
      clientToken?: string;
      requestUser: boolean;
      agent: {
        name: "Minecraft";
        version: 1;
      };
    }
    export const Body: Schema<Body> = Schema.object({
      username: Schema.string().required(),
      password: Schema.string().required(),
      clientToken: Schema.string(),
      requestUser: Schema.boolean().required(),
      agent: Schema.const({
        name: "Minecraft",
        version: 1,
      }).required(),
    });

    export interface Response {
      accessToken: string;
      clientToken: string;
      availableProfiles: Profile[];
      selectedProfile?: Profile;
      user?: User;
    }
    export const Response: Schema<Response> = Schema.object({
      accessToken: Schema.string().required(),
      clientToken: Schema.string().required(),
      availableProfiles: Schema.array(Profile).required(),
      selectedProfile: Profile,
      user: User,
    });
  }

  export namespace Refresh {
    export interface Body {
      accessToken: string;
      clientToken?: string;
      requestUser: boolean;
      selectedProfile?: Profile;
    }
    export const Body: Schema<Body> = Schema.object({
      accessToken: Schema.string().required(),
      clientToken: Schema.string(),
      requestUser: Schema.boolean().default(false),
      selectedProfile: Profile,
    });

    export interface Response {
      accessToken: string;
      clientToken: string;
      selectedProfile?: Profile;
      user?: User;
    }
    export const Response: Schema<Response> = Schema.object({
      accessToken: Schema.string().required(),
      clientToken: Schema.string().required(),
      selectedProfile: Profile,
      user: User,
    });
  }

  export namespace Validate {
    export interface Body {
      accessToken: string;
      clientToken?: string;
    }
    export const Body: Schema<Body> = Schema.object({
      accessToken: Schema.string().required(),
      clientToken: Schema.string(),
    });
  }

  export namespace Invalidate {
    export interface Body {
      accessToken: string;
      clientToken?: string;
    }
    export const Body: Schema<Body> = Schema.object({
      accessToken: Schema.string().required(),
      clientToken: Schema.string(),
    });
  }

  export namespace SignOut {
    export interface Body {
      username: string;
      password: string;
    }
    export const Body: Schema<Body> = Schema.object({
      username: Schema.string().required(),
      password: Schema.string().required(),
    });
  }
}
