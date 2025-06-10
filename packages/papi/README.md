# Libticketto: PAPI (with Kippu API)

This library is a pure on-chain based implementation of [The Ticketto Protocol][1], powered
by [Polkadot-API][3]. It leverages on an external signature mechanism (provided by the client).

## Usage

```ts
import { VirtoSigner, kreivoBlockChallenger } from "@virtonetwork/signer";
import { WebAuthn } from "@virtonetwork/authenticatorss-webauthn";

// Setup the app authenticator.
const authenticator = new WebAuthn("rick@kippu.rocks", kreivoBlockChallenger)
  .setup();
const signer = new KreivoPassSigner(authenticator);

// Initialize the ticketto client.
const client = await new TickettoClientBuilder()
  .withConsumer(KippuPAPIConsumer)
  .withConfig({
    chainEndpoint: "wss://kreivo.kippu.rocks",
    kippuApi: "https://api.kippu.rocks",
    accountProvider: {
      getAccountId() {
        AccountId(signer.publicKey)
      }
    }
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
