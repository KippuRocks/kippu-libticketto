import { DAY, NOW } from "../fixtures/constants.ts";

import { EVENT } from "../fixtures/events.ts";
import { TickettoClient } from "@ticketto/protocol";

export async function createEvent(
  tickettoClient: TickettoClient,
  ix: number,
  bumpToSales = false
) {
  const eventId = await tickettoClient.events.calls.createEvent({
    ...EVENT,
    name: `Event ${ix}`,
    dates: [[NOW - DAY, NOW + DAY]],
  });

  if (bumpToSales) {
    await tickettoClient.events.calls.bumpState(eventId);
  }

  return eventId;
}
