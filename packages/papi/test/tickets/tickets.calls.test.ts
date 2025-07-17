import { MultiAddress, kreivo } from "@kippurocks/papi-descriptors";
import { SupportChopsticksClient, getChopsticksClient, prepare } from "../support/prepare/index.ts";
import { after, before, beforeEach, describe, it } from "node:test";

import { KreivoApi } from "../../src/types.ts";
import { TickettoClient } from "@ticketto/protocol";
import assert from "node:assert";
import { contractRevertedError } from "../support/fixtures/tickets.ts";
import { createEvent } from "../support/helpers/create-event.ts";
import { getProviderFromSigner } from "../support/helpers/get-provider-from-signer.ts";
import { getTickettoClient } from "../support/helpers/get-ticketto-client.ts";
import { keyring } from "../support/helpers/dev-keyrring.ts";

describe("KippuTicketsCalls", async () => {
  let client: SupportChopsticksClient["client"];
  let teardown: SupportChopsticksClient["teardown"];

  before(async () => {
    ({ client, teardown } = await getChopsticksClient());
    await prepare(client);
  });

  describe("issue", async () => {
    let ALICE: TickettoClient;
    before(async () => {
      ALICE = await getTickettoClient(
        client,
        getProviderFromSigner(keyring.Alice.signer)
      );
    });

    it("fails if not on sales state", async () => {
      const eventId = await createEvent(ALICE, 1);
      await assert.rejects(ALICE.tickets.calls.issue(eventId));
    });

    it("issues a ticket if on sales state", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      await ALICE.tickets.calls.issue(eventId);
    });

    it("issues tickets given the issuance limit", async () => {
      const eventId = await createEvent(ALICE, 1);
      await ALICE.events.calls.update(eventId, {
        capacity: 2n,
      });
      await ALICE.events.calls.bumpState(eventId);

      // Issues one ticket only.
      await ALICE.tickets.calls.issue(eventId);
      await ALICE.tickets.calls.issue(eventId);
      await assert.rejects(ALICE.tickets.calls.issue(eventId));
    });
  });

  describe("submitAttendanceCall", async () => {
    let kreivoApi: KreivoApi;

    let merchantId: number;
    before(async () => {
      kreivoApi = client.getTypedApi(kreivo);
      const eventsContractAddress =
        (await kreivoApi.query.ContractsStore.ContractAccount.getValue([
          0,
          0n,
        ]))!;
      merchantId =
        (await kreivoApi.query.ContractsStore.ContractMerchantId.getValue(
          eventsContractAddress
        ))!;
    });

    let ALICE: TickettoClient;
    let BOB: TickettoClient;
    let CHARLIE: TickettoClient;
    beforeEach(async () => {
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

    it("fails if not the contract owner", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      const ticketId = await ALICE.tickets.calls.issue(eventId);
      await ALICE.events.calls.bumpState(eventId);

      const attendanceCallBytes = await BOB.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );

      await assert.rejects(
        CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes),
        contractRevertedError
      );
    });

    it("fails if event has not started yet", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      const ticketId = await ALICE.tickets.calls.issue(eventId);
      kreivoApi.tx.ListingsCatalog.transfer({
        collection: [merchantId, eventId],
        item: ticketId,
        dest: MultiAddress.Id(keyring.Bob.address),
      }).signAndSubmit(keyring.Alice.signer);

      const attendanceCallBytes = await BOB.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );

      await assert.rejects(
        CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes),
        contractRevertedError
      );
    });

    it.only("works marking the attendance", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      const ticketId = await ALICE.tickets.calls.issue(eventId);
      await BOB.events.calls.bumpState(eventId);

      const attendanceCallBytes = await ALICE.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );

      await CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes);
      await new Promise((r) => setTimeout(r, 2_000));
    });

    it.only("fails resending the same attendance call", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      const ticketId = await ALICE.tickets.calls.issue(eventId);

      await BOB.events.calls.bumpState(eventId);
      (await BOB.events.query.get(eventId))?.state === 2;

      const attendanceCallBytes = await ALICE.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );
      await CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes);
      await new Promise((r) => setTimeout(r, 2_000));

      await assert.rejects(
        CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes),
        { message: "InvalidTransaction" }
      );
    });

    it.only("fails if the attendance is already marked", async () => {
      const eventId = await createEvent(ALICE, 1, true);
      const ticketId = await ALICE.tickets.calls.issue(eventId);

      await BOB.events.calls.bumpState(eventId);
      (await BOB.events.query.get(eventId))?.state === 2;

      const attendanceCallBytes = await ALICE.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );
      await CHARLIE.tickets.calls.submitAttendanceCall(attendanceCallBytes);
      await new Promise((r) => setTimeout(r, 2_000));

      const secondAttendanceCallBytes = await ALICE.tickets.query.attendanceRequest(
        eventId,
        ticketId
      );
      await assert.rejects(
        CHARLIE.tickets.calls.submitAttendanceCall(secondAttendanceCallBytes),
        contractRevertedError
      );
    });
  });

  after(async () => {
    await teardown();
  });
});
