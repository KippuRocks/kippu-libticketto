import { Account, AccountId } from "@ticketto/types";
import { DirectoryCalls, DirectoryStorage } from "@ticketto/protocol";
import { inject, injectable } from "inversify";
import {
  KippuApiContact,
  KippuApiUser,
  KippuConsumerSettings,
  TOKEN,
} from "./types.ts";

// Note: It is expected that directory calls are handled internally by the
// applications. This connection is only for reads.
@injectable()
export class KippuDirectoryCalls implements DirectoryCalls {
  constructor() {}

  async insert() {
    throw new Error("Method not implemented");
  }

  async setIdentity() {
    throw new Error("Method not implemented");
  }
}

@injectable()
export class KippuDirectoryStorage implements DirectoryStorage {
  private url: (params?: Record<string, string>) => URL;
  private byAccount: (id: AccountId) => URL;

  constructor(
    @inject(TOKEN.SETTINGS) private readonly settings: KippuConsumerSettings
  ) {
    this.url = (params: Record<string, string> = {}) => {
      let url = new URL("/contacts", this.settings.api.endpoint);
      url.search = new URLSearchParams(params).toString();
      return url;
    };
    this.byAccount = (accountId: AccountId) =>
      new URL(`/user/${accountId}`, this.settings.api.endpoint);
  }

  private async processRequest<T>(url: () => URL): Promise<T | undefined> {
    const response = await fetch(url());

    switch (true) {
      case response.ok:
        return response.json();
      case response.status === 404:
        return undefined;
      default:
        throw new Error(response.statusText);
    }
  }

  async all() {
    return this.processRequest<KippuApiContact[]>(() => this.url()).then((r) =>
      (r ?? []).map((contact) => {
        return {
          id: contact.accountId,
          assets: {},
          balance: {},
          identity: {
            email: contact.email,
            firstName: contact.name,
          },
        } as Account;
      })
    );
  }

  async indexByDisplay(display: string) {
    return this.processRequest<KippuApiContact[]>(() =>
      this.url({ by: display })
    ).then((r) =>
      (r ?? []).map((contact) => {
        return {
          id: contact.accountId,
          assets: {},
          balance: {},
          identity: {
            email: contact.email,
            firstName: contact.name,
          },
        } as Account;
      })
    );
  }

  async indexByPhone(phone: string) {
    return this.processRequest<KippuApiContact[]>(() =>
      this.url({ by: phone })
    ).then((r) =>
      (r ?? []).map((contact) => {
        return {
          id: contact.accountId,
          assets: {},
          balance: {},
          identity: {
            email: contact.email,
            firstName: contact.name,
          },
        } as Account;
      })
    );
  }

  async indexByEmail(email: string) {
    return this.processRequest<KippuApiContact[]>(() =>
      this.url({ by: email })
    ).then((r) =>
      (r ?? []).map((contact) => {
        return {
          id: contact.accountId,
          assets: {},
          balance: {},
          identity: {
            email: contact.email,
            firstName: contact.name,
          },
        } as Account;
      })
    );
  }

  async get(accountId: AccountId) {
    return this.processRequest<KippuApiUser>(() =>
      this.byAccount(accountId)
    ).then((user) => {
      return user
        ? ({
            id: user.contact.accountId,
            assets: {},
            balance: {},
            identity: {
              display: user.username,
              email: user.contact.email,
              firstName: user.contact.name,
            },
          } as Account)
        : undefined;
    });
  }
}
