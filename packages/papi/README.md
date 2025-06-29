# Libticketto: PAPI (with Kippu API)

This library is a pure on-chain based implementation of [The Ticketto Protocol][1], powered
by [Polkadot-API][3]. It leverages on an external signature mechanism (provided by the client).

## Usage

```ts
import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { KreivoPassSigner, kreivoBlockChallenger } from "@virtonetwork/signer";
import { WebAuthn } from "@virtonetwork/authenticators-webauthn";
import { TickettoClientBuilder } from "@libticketto/protocol";
import {
  KippuAccountProvider,
  KippuPAPIConsumer,
  isKreivoTx,
} from "@kippurocks/libticketto-papi";

// Setup the app authenticator.
const client = createClient(
  getWsProvider("wss://kreivo.kippu.rocks")
);
const authenticator = new WebAuthn("rick@kippu.rocks", kreivoBlockChallenger)
  .setup();
const signer = new KreivoPassSigner(authenticator);

// Initialize the ticketto client.
const client = await new TickettoClientBuilder()
  .withConsumer(KippuPAPIConsumer)
  .withConfig({
    client,
    apiEndpoint: "https://api.kippu.rocks",
    accountProvider: {
      getAccountId() {
        AccountId(signer.publicKey)
      }
      sign<T>(payload: T) {
        if (!isKreivoTx(payload)) {
          throw new Error("Cannot sign payload");
        }

        return Binary.fromHex(
          await payload.sign(signer)
        ).asBytes();
      }
    } as KippuAccountProvider,
  })
  .build();

// Call the Kippu API to get an account given an
// email (or invite them).
const [account] = await client.directory
  .indexByEmail("chuck@kippu.rocks");

// Prepare, sign and submit the transfer transaction
await client.tickets.calls.transfer(1, 1, account.id);
```

[1]: https://github.com/kippurocks/ticketto
[3]: https://papi.how
