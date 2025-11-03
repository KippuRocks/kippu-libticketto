import { KippuConfig, isKreivoTx } from "../src/types.ts";
import { KreivoPassSigner, blockHashChallenger } from "@virtonetwork/signer";
import { after, before, describe, it } from "node:test";
import { getChopsticksClient, prepare } from "./support/prepare/index.ts";

import { Binary } from "polkadot-api";
import { KippuPAPIConsumer } from "../src/index.ts";
import { TickettoClientBuilder } from "@ticketto/protocol";
import { WebAuthn } from "@virtonetwork/authenticators-webauthn";
import assert from "node:assert";
import { kreivo } from "@kippurocks/papi-descriptors";
import { mockWebAuthnEmulation } from "./support/helpers/webauthn-mock.ts";
import { ss58Encode } from "@polkadot-labs/hdkd-helpers";

mockWebAuthnEmulation();

describe("KippuPAPIConsumer", async () => {
  const { client, teardown } = await getChopsticksClient();
  const api = client.getTypedApi(kreivo);

  before(() => prepare(client));

  it("Initializes the `TickettoClient` correctly", async () => {
    // Setup the app authenticator.
    const authenticator = await new WebAuthn(
      "rick@kippu.rocks",
      blockHashChallenger(client)
    ).setup();
    const signer = new KreivoPassSigner(authenticator);

    const eventsContractAddress =
      await api.query.ContractsStore.ContractAccount.getValue([0, 0n], {
        at: "best",
      });
    assert.ok(eventsContractAddress);

    const ticketsContractAddress =
      await api.query.ContractsStore.ContractAccount.getValue([1, 0n], {
        at: "best",
      });
    assert.ok(ticketsContractAddress);

    const config: KippuConfig = {
      accountProvider: {
        getAccountId() {
          return ss58Encode(signer.publicKey);
        },
        async sign<S>(payload: S): Promise<Uint8Array> {
          if (!isKreivoTx(payload)) {
            throw new Error("Cannot sign a non-kreivo compatible transaction");
          }
          return Binary.fromHex(await payload.sign(signer)).asBytes();
        },
      },
      consumerSettings: {
        client,
        api: {
          endpoint: "https://api.kippu.rocks",
          clientId: ":clientId:",
          clientSecret: ":clientSecret:",
        },
        eventsContractAddress: eventsContractAddress,
        ticketsContractAddress: ticketsContractAddress,
      },
    };

    // Initialize the ticketto client.
    const tickettoClient = await new TickettoClientBuilder()
      .withConsumer(KippuPAPIConsumer)
      .withConfig(config)
      .build();

    assert.ok(tickettoClient);
  });

  after(teardown);
});
