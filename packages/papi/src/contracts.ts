import {
  EventsContract,
  KippuConsumerSettings,
  TicketsContract,
} from "./types.ts";
import { InkSdkTypedApi, createInkSdk } from "@polkadot-api/sdk-ink";

import { contracts } from "@polkadot-api/descriptors";

export function getContracts(
  settings: KippuConsumerSettings,
  kreivo: InkSdkTypedApi
): { events: EventsContract; tickets: TicketsContract } {
  const eventsSdk = createInkSdk(kreivo, contracts.tickettoEvents);
  const ticketsSdk = createInkSdk(kreivo, contracts.tickettoTickets);

  return {
    events: eventsSdk.getContract(settings.eventsContractAddress as string),
    tickets: ticketsSdk.getContract(settings.ticketsContractAddress as string),
  };
}
