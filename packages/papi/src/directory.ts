import { Account, AccountId, AccountIdentity } from "@ticketto/types";
import { DirectoryCalls, DirectoryStorage } from "@ticketto/protocol";
import { inject, injectable } from "inversify";
import { KippuConsumerSettings, TOKEN } from "./types.ts";

@injectable()
export class KippuDirectoryCalls implements DirectoryCalls {
  private url: URL;
  private byAccount: (id: AccountId) => URL;

  constructor(
    @inject(TOKEN.SETTINGS) private readonly settings: KippuConsumerSettings
  ) {
    this.url = new URL("/directory", this.settings.apiEndpoint);
    this.byAccount = (accountId: AccountId) =>
      new URL(`/directory/${accountId}`, this.settings.apiEndpoint);
  }

  async processRequest(response: Response) {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
  }

  async insert(accountId: AccountId, identity: AccountIdentity): Promise<void> {
    return this.processRequest(
      await fetch(this.url, {
        method: "POST",
        body: JSON.stringify({
          accountId,
          identity,
        }),
      })
    );
  }

  async setIdentity(
    accountId: AccountId,
    identity: Partial<AccountIdentity>
  ): Promise<void> {
    return this.processRequest(
      await fetch(this.byAccount(accountId), {
        method: "PUT",
        body: JSON.stringify({ identity }),
      })
    );
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
      let url = new URL("/directory", this.settings.apiEndpoint);
      url.search = new URLSearchParams(params).toString();
      return url;
    };
    this.byAccount = (accountId: AccountId) =>
      new URL(`/directory/${accountId}`, this.settings.apiEndpoint);
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
    return this.processRequest<Account[]>(() => this.url()).then(
      (r) => r ?? []
    );
  }

  async indexByDisplay(display: string) {
    return this.processRequest<Account[]>(() => this.url({ display })).then(
      (r) => r ?? []
    );
  }

  async indexByPhone(phone: string) {
    return this.processRequest<Account[]>(() => this.url({ phone })).then(
      (r) => r ?? []
    );
  }

  async indexByEmail(email: string) {
    return this.processRequest<Account[]>(() => this.url({ email })).then(
      (r) => r ?? []
    );
  }

  async get(accountId: AccountId) {
    return this.processRequest<Account>(() => this.byAccount(accountId));
  }
}
