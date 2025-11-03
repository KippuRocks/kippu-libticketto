import {
  EventsContract,
  KippuConsumerSettings,
  TicketsContract,
} from "./types.ts";
import { InkSdkTypedApi, createInkV5Sdk } from "@polkadot-api/sdk-ink";

import { contracts } from "@kippurocks/papi-descriptors";

export function getContracts(
  settings: KippuConsumerSettings,
  kreivo: InkSdkTypedApi
): { events: EventsContract; tickets: TicketsContract } {
  const eventsSdk = createInkV5Sdk(kreivo, contracts.tickettoEvents);
  const ticketsSdk = createInkV5Sdk(kreivo, contracts.tickettoTickets);

  return {
    events: eventsSdk.getContract(settings.eventsContractAddress as string),
    tickets: ticketsSdk.getContract(settings.ticketsContractAddress as string),
  };
}
