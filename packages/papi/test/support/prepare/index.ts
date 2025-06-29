import { ChopsticksProvider, setup } from "@acala-network/chopsticks-core";
import { DevKeyring, keyring } from "../helpers/dev-keyrring.ts";
import { PolkadotClient, createClient } from "polkadot-api";

import { defaultLogger } from "@acala-network/chopsticks-core";
import { getPapiChopsticksProvider } from "./chopsticks-provider.ts";

export type SupportChopsticksClient = Awaited<ReturnType<typeof getChopsticksClient>>;

export async function getChopsticksClient() {
  const registeredTypes = {
    typesBundle: {
      spec: {
        "kreivo-parachain": {
          signedExtensions: {
            PassAuthenticate: {
              extrinsic: {
                authenticateParams:
                  "Option<FcPalletPassExtensionsAuthenticateParams>",
              },
              payload: {},
            },
          },
        },
      },
    },
  };

  const context = await setup({
    endpoint: "wss://testnet.kreivo.kippu.rocks",
    mockSignatureHost: true,
    registeredTypes,
    runtimeLogLevel: 1,
  });

  const provider = new ChopsticksProvider(context);
  const client = createClient(getPapiChopsticksProvider(provider));

  return {
    provider,
    client,
    async teardown() {
      client.destroy();
      await provider.disconnect();
      await context.close();
    },
    setLogLevel(value: typeof defaultLogger.level) {
      defaultLogger.level = value;
    },
    setRuntimeLogLevel(value: number) {
      context.runtimeLogLevel = value;
    }
  };
}

const UNIT = 10 ** 10;
export async function prepare(client: PolkadotClient) {
  const dUSD = {
    Sibling: {
      id: 1_000,
      pallet: 50,
      index: 50_000_002,
    },
  };

  await client._request("dev_setStorage", [
    {
      Assets: {
        Asset: [
          [
            [dUSD],
            {
              owner: keyring.Alice.address,
              issuer: keyring.Alice.address,
              admin: keyring.Alice.address,
              freezer: keyring.Alice.address,
              supply: 100_000 * 10 ** 6,
              deposit: 0,
              min_balance: 100,
              is_sufficient: 0,
              accounts: 6,
              sufficients: 0,
              approvals: 0,
              status: "Live",
            },
          ],
        ],
        Metadata: [
          [
            [dUSD],
            {
              decent: 0,
              name: "decent USD",
              symbol: "dUSD",
              decimals: 6,
              is_frozen: 0,
            },
          ],
        ],
      },
      System: {
        Account: Object.getOwnPropertyNames(keyring).map((name) => [
          [keyring[name as keyof DevKeyring].address],
          {
            nonce: 0,
            consumers: 0,
            providers: 1,
            sufficients: 0,
            data: {
              free: 100_000 * UNIT,
              reserved: 0,
              frozen: 0,
              flags: 0,
            },
          },
        ]),
      },
    },
  ]);
}
