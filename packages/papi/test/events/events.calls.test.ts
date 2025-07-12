import { DAY, HOUR, NOW, SECOND } from "../support/fixtures/constants.ts";
import { DateRange, EventId } from "@ticketto/types";
import { after, before, beforeEach, describe, it } from "node:test";
import { getChopsticksClient, prepare } from "../support/prepare/index.ts";
import { keyring, signerFromTime } from "../support/helpers/dev-keyrring.ts";

import { EVENT } from "../support/fixtures/events.ts";
import { PolkadotClient } from "polkadot-api";
import { TickettoClient } from "@ticketto/protocol";
import assert from "node:assert";
import { getProviderFromSigner } from "../support/helpers/get-provider-from-signer.ts";
import { getTickettoClient } from "../support/helpers/get-ticketto-client.ts";
import { kreivo } from "@kippurocks/papi-descriptors";

const TODAY_EVENT: DateRange = [NOW, NOW + DAY];
const TOMORROW_EVENT: DateRange = [NOW + DAY, NOW + 2n * DAY];

describe("KippuEventsCalls", async () => {
  let client: PolkadotClient;
  let teardown: () => Promise<void>;

  before(async () => {
    ({ client, teardown } = await getChopsticksClient());
    await prepare(client);
  });

  describe("createEvent", async () => {
    it("fails when the signer cannot provide funds", async () => {
      const { signer, address } = await signerFromTime();
      client._request("dev_setStorage", [
        {
          System: {
            Account: [[[address], { providers: 1, data: { free: 10 ** 9 } }]],
          },
        },
      ]);

      const RANDO = await getTickettoClient(
        client,
        getProviderFromSigner(signer)
      );

      await assert.rejects(
        RANDO.events.calls.createEvent(EVENT),
        new Error("CannotCreateEvent")
      );
    });

    it("creating an event works", async () => {
      const ALICE = await getTickettoClient(
        client,
        getProviderFromSigner(keyring.Alice.signer)
      );

      const eventId = await ALICE.events.calls.createEvent(EVENT);

      assert.deepEqual(await ALICE.events.query.get(eventId), {
        id: eventId,
        organiser: keyring.Alice.address,
        state: 0,
        ...EVENT,
      });
    });
  });

  describe("update", async () => {
    let ALICE: TickettoClient;
    let BOB: TickettoClient;

    let eventId: EventId;
    before(async () => {
      ALICE = await getTickettoClient(
        client,
        getProviderFromSigner(keyring.Alice.signer)
      );
      BOB = await getTickettoClient(
        client,
        getProviderFromSigner(keyring.Bob.signer)
      );

      eventId = await ALICE.events.calls.createEvent(EVENT);
    });

    it("fails if the caller is not the event organiser", async () => {
      await assert.rejects(
        BOB.events.calls.update(eventId, {
          dates: [TODAY_EVENT],
        })
      );
    });

    it("works setting some values", async () => {
      await ALICE.events.calls.update(eventId, {
        capacity: 200n,
        dates: [TODAY_EVENT],
      });

      const event = await ALICE.events.query.get(eventId);

      assert.equal(event?.capacity, 200n);
      assert.deepEqual(event?.dates, [TODAY_EVENT]);
    });
  });

  after(async () => {
    await teardown();
  });

  describe("bumpState", () => {
    describe("created -> sales", async () => {
      let ALICE: TickettoClient;
      let BOB: TickettoClient;

      let eventId: EventId;
      before(async () => {
        ALICE = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Alice.signer)
        );
        BOB = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Bob.signer)
        );
        eventId = await ALICE.events.calls.createEvent(EVENT);
      });

      it("fails if the event does not have set dates", async () => {
        await assert.rejects(ALICE.events.calls.bumpState(eventId), {
          message: "DatesNotSet",
        });
      });

      it("fails if the caller does not have permissions", async () => {
        await ALICE.events.calls.update(eventId, {
          dates: [TODAY_EVENT],
        });

        await assert.rejects(BOB.events.calls.bumpState(eventId), {
          message: "NoPermission",
        });
      });

      it("works bumping state", async () => {
        await ALICE.events.calls.update(eventId, {
          dates: [TODAY_EVENT],
        });
        await ALICE.events.calls.bumpState(eventId);
      });
    });

    describe("sales -> ongoing", async () => {
      let ALICE: TickettoClient;
      let BOB: TickettoClient;

      before(async () => {
        ALICE = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Alice.signer)
        );
        BOB = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Bob.signer)
        );
      });

      let eventId: EventId;
      beforeEach(async () => {
        eventId = await ALICE.events.calls.createEvent({
          ...EVENT,
          dates: [],
        });
        await ALICE.events.calls.bumpState(eventId);
      });

      it("fails if initial date is not set", async () => {
        await assert.rejects(BOB.events.calls.bumpState(eventId), {
          message: "DatesNotSet",
        });
      });

      it("fails if initial date is invalid", async () => {
        // Event starts tomorrow.
        await ALICE.events.calls.update(eventId, {
          dates: [TOMORROW_EVENT],
        });

        await assert.rejects(ALICE.events.calls.bumpState(eventId), {
          message: "InvalidState",
        });
      });

      it("works so anyone can bump this state", async () => {
        await ALICE.events.calls.update(eventId, {
          dates: [[NOW, NOW + DAY]],
        });
        await BOB.events.calls.bumpState(eventId);
      });
    });

    describe("ongoing -> finished", () => {
      const SHORT_LIVED_EVENT: DateRange = [NOW - HOUR, NOW];

      let ALICE: TickettoClient;
      let BOB: TickettoClient;
      let eventId: EventId;
      before(async () => {
        ALICE = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Alice.signer)
        );
        BOB = await getTickettoClient(
          client,
          getProviderFromSigner(keyring.Bob.signer)
        );

        eventId = await ALICE.events.calls.createEvent({
          ...EVENT,
          dates: [SHORT_LIVED_EVENT],
        });
        const event = await ALICE.events.query.get(eventId);
        assert.equal(event?.state, 0);
        assert.deepEqual(event?.date, SHORT_LIVED_EVENT);

        // created -> sales
        await ALICE.events.calls.bumpState(eventId);
        assert.equal((await ALICE.events.query.get(eventId))?.state, 1);

        // sales -> ongoing
        await ALICE.events.calls.bumpState(eventId);
        assert.equal((await ALICE.events.query.get(eventId))?.state, 2);
      });

      it("fails to mark a currently ongoing event as finished", () => {
        return assert.rejects(BOB.events.calls.bumpState(eventId), {
          message: "InvalidState",
        });
      });

      it("works finishing the event once last date elapsed", async () => {
        // Wait until the event finishes.
        const kreivoApi = client.getTypedApi(kreivo);
        const [, eventEndsAt] = SHORT_LIVED_EVENT;
        const blockTimestamp = await kreivoApi.query.Timestamp.Now.getValue();

        if (eventEndsAt > blockTimestamp) {
          const remainingBlocks = (eventEndsAt - blockTimestamp) / (6n * SECOND);

          await client._request("dev_newBlock", [
            { count: Number(remainingBlocks) + 1 },
          ]);
        }

        const nowBlockTimestamp = await kreivoApi.query.Timestamp.Now.getValue();
        assert(
          eventEndsAt <= nowBlockTimestamp,
          `Expected ${eventEndsAt} <= ${nowBlockTimestamp}`
        );
        await BOB.events.calls.bumpState(eventId);
      });
    });
  });
});

