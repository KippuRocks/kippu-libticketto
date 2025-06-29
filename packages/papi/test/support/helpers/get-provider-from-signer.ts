import { Binary, PolkadotSigner } from "polkadot-api";
import { KippuAccountProvider, isKreivoTx } from "../../../src/types.ts";

import { ss58Address } from "@polkadot-labs/hdkd-helpers";

export function getProviderFromSigner(signer: PolkadotSigner) {
  return {
    getAccountId() {
      return ss58Address(signer.publicKey);
    },
    async sign<T>(payload: T) {
      if (!isKreivoTx(payload)) {
        throw new Error("Cannot sign payload");
      }

      return Binary.fromHex(await payload.sign(signer, {
        mortality: {
          mortal: false,
        }
      })).asBytes();
    },
  } as KippuAccountProvider;
}
