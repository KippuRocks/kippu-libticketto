import {
  DirectoryCalls,
  DirectoryStorage,
  EventsCalls,
  EventsStorage,
  TicketsCalls,
  TicketsStorage,
  TickettoClient,
  TickettoConsumer,
} from "@ticketto/protocol";
import { EventQueue, WebStubEventSubscribtion } from "./subscriptions.ts";
import { KippuConfig, TOKEN } from "./types.ts";
import { KippuDirectoryCalls, KippuDirectoryStorage } from "./directory.ts";
import { KippuEventsCalls, KippuEventsStorage } from "./events.ts";
import { KippuTicketsCalls, KippuTicketsStorage } from "./tickets.ts";
import { contracts, kreivo } from "@kippurocks/papi-descriptors";

import { Container } from "inversify";
import { TickettoModelConverter } from "./tickettoModel.ts";
import { TransactionSubmitter } from "./submitter.ts";
import { createInkSdk } from "@polkadot-api/sdk-ink";

export {
  isKreivoTx,
  KreivoTx,
  KippuConsumerSettings,
  KippuConfig,
  KippuAccountProvider,
} from "./types.ts";

export class KippuPAPIConsumer
  implements TickettoConsumer<KippuConfig> {
  private container = new Container();

  constructor() {
    this.container.bind(TOKEN.QUEUE).toConstantValue(new EventQueue());
    this.container.bind(TOKEN.SUBMITTER).to(TransactionSubmitter);
    this.container.bind<DirectoryCalls>(KippuDirectoryCalls).toSelf();
    this.container.bind<DirectoryStorage>(KippuDirectoryStorage).toSelf();
    this.container.bind<EventsCalls>(KippuEventsCalls).toSelf();
    this.container.bind<EventsStorage>(KippuEventsStorage).toSelf();
    this.container.bind<TicketsCalls>(KippuTicketsCalls).toSelf();
    this.container.bind<TicketsStorage>(KippuTicketsStorage).toSelf();
    this.container.bind(WebStubEventSubscribtion).toSelf();
  }

  async build(config?: KippuConfig) {
    if (config === undefined) {
      throw new TypeError(
        "A valid `KippuConfig` is required to initialize the `KippuPAPIConsumer`"
      );
    }

    this.container
      .bind(TOKEN.ACCUNT_PROVIDER)
      .toConstantValue(config.accountProvider);
    this.container
      .bind(TOKEN.SETTINGS)
      .toConstantValue(config.consumerSettings);

    const consumerSettings = config.consumerSettings;

    this.container
      .bind(TOKEN.MERCHANT_ID)
      .toConstantValue(consumerSettings.merchantId ?? 3);
    this.container
      .bind(TOKEN.POLKADOT_CLIENT)
      .toConstantValue(consumerSettings.client);

    // Initialize Kreivo API
    const kreivoApi = consumerSettings.client.getTypedApi(kreivo);
    this.container.bind(TOKEN.KREIVO_API).toConstantValue(kreivoApi);
    this.container.bind(TickettoModelConverter).toSelf();

    // Initialize Events contract
    const eventsSdk = createInkSdk(kreivoApi, contracts.tickettoEvents);
    this.container
      .bind(TOKEN.EVENTS_CONTRACT)
      .toConstantValue(
        eventsSdk.getContract(consumerSettings.eventsContractAddress)
      );
    this.container
      .bind(TOKEN.EVENTS_CONTRACT_ADDRESS)
      .toConstantValue(consumerSettings.eventsContractAddress);

    // Initialize Tickets contract
    const ticketsSdk = createInkSdk(kreivoApi, contracts.tickettoTickets);
    this.container
      .bind(TOKEN.TICKETS_CONTRACT)
      .toConstantValue(
        ticketsSdk.getContract(consumerSettings.ticketsContractAddress)
      );

    return {
      accountProvider: this.container.get(TOKEN.ACCUNT_PROVIDER),
      directory: {
        calls: this.container.get(KippuDirectoryCalls),
        query: this.container.get(KippuDirectoryStorage),
      },
      events: {
        calls: this.container.get(KippuEventsCalls),
        query: this.container.get(KippuEventsStorage),
      },
      tickets: {
        calls: this.container.get(KippuTicketsCalls),
        query: this.container.get(KippuTicketsStorage),
      },
      systemEvents: this.container.get(WebStubEventSubscribtion),
    } as TickettoClient;
  }
}
