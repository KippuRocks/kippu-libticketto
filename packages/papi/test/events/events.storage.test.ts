import { KreivoApi, KreivoTx } from "../../src/types.ts";
import { after, before, describe, it } from "node:test";
import { getChopsticksClient, prepare } from "../support/prepare/index.ts";

import { PolkadotClient } from "polkadot-api";
import { TickettoClient } from "@ticketto/protocol";
import assert from "node:assert";
import { createEvent } from "../support/helpers/create-event.ts";
import { getProviderFromSigner } from "../support/helpers/get-provider-from-signer.ts";
import { getTickettoClient } from "../support/helpers/get-ticketto-client.ts";
import { keyring } from "../support/helpers/dev-keyrring.ts";
import { kreivo } from "@polkadot-api/descriptors";

// Note: For simplicity, we omit the `get` method, as it's already heavily used in the `KippuEventCalls` suite, as well as within
// this same suite.

describe("KippuEventsStorage", async () => {
  let client: PolkadotClient;
  let kreivoApi: KreivoApi;
  let teardown: () => Promise<void>;

  let ALICE: TickettoClient<KreivoTx>;
  let BOB: TickettoClient<KreivoTx>;
  let CHARLIE: TickettoClient<KreivoTx>;
  let merchantId: number;
  before(async () => {
    ({ client, teardown } = await getChopsticksClient());
    await prepare(client);

    kreivoApi = client.getTypedApi(kreivo);

    ALICE = await getTickettoClient(
      client,
      getProviderFromSigner(keyring.Alice.signer)
    );
    BOB = await getTickettoClient(
      client,
      getProviderFromSigner(keyring.Bob.signer)
    );
    CHARLIE = await getTickettoClient(
      client,
      getProviderFromSigner(keyring.Charlie.signer)
    );
  });

  it("all", async () => {
    await new Array(10).fill(0).reduce(async (p, _, i) => {
      await p;
      await createEvent(BOB, i);
    }, Promise.resolve());

    assert((await BOB.events.query.all()).length >= 10);
  });

  it("organizerOf", async () => {
    await new Array(5).fill(0).reduce(async (p, _, i) => {
      await p;
      await createEvent(ALICE, i);
    }, Promise.resolve());

    const aliceEvents = await ALICE.events.query.organizerOf(
      keyring.Alice.address
    );
    assert(aliceEvents.length == 5);
  });

  it("ticketHolderOf", async () => {
    const eventId = await createEvent(ALICE, 1, true);
    await ALICE.tickets.calls.issue(eventId);

    assert(
      (await BOB.tickets.query.ticketHolderOf(keyring.Alice.address)).length ==
        1
    );
    assert(
      (await BOB.tickets.query.ticketHolderOf(keyring.Bob.address)).length == 0
    );
  });

  after(async () => {
    await teardown();
  });
});
