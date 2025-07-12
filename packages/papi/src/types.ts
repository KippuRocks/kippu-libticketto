import { PolkadotClient, TypedApi } from "polkadot-api";

import { AccountId } from "@ticketto/types";
import { ClientConfig } from "@ticketto/protocol";
import { Enum } from "@polkadot-api/substrate-bindings";
import { contracts, kreivo } from "@kippurocks/papi-descriptors";
import { createInkSdk, InkSdkTypedApi } from "@polkadot-api/sdk-ink";

export async function currency(client: PolkadotClient) {
  const spec = await client.getChainSpecData();
  let UNIT: bigint;
  let CENTS: bigint;
  let MILLICENTS: bigint;

  if (spec.name.includes("Paseo")) {
    UNIT = 10n ** 10n;
    CENTS = UNIT / 100n;
  } else {
    UNIT = 10n ** 12n;
    const QUID = UNIT / 30n;
    CENTS = QUID / 100n;
  }

  MILLICENTS = CENTS / 1000n;

  return { UNIT, CENTS, MILLICENTS };
}

// Kreivo API
export type KreivoApi = TypedApi<typeof kreivo>;

// Contracts SDK
export type EventContractTypes =
  (typeof contracts)["tickettoEvents"]["__types"];
export type TicketsContractTypes =
  (typeof contracts)["tickettoTickets"]["__types"];

type EventsSdk = ReturnType<
  typeof createInkSdk<InkSdkTypedApi, (typeof contracts)["tickettoEvents"]>
>;
type TicketsSdk = ReturnType<
  typeof createInkSdk<InkSdkTypedApi, (typeof contracts)["tickettoTickets"]>
>;
export type EventsContract = ReturnType<EventsSdk["getContract"]>;
export type TicketsContract = ReturnType<TicketsSdk["getContract"]>;

// Kippu Config
export type KreivoApiCall = ReturnType<KreivoApi["txFromCallData"]>;
export type EventsContractCall = ReturnType<EventsContract["send"]>;
export type TicketsContractCall = ReturnType<TicketsContract["send"]>;

export function isKreivoTx(value: unknown): value is KreivoTx {
  return value !== undefined
    && value !== null
    && typeof value === "object"
    && "sign" in value
    && typeof value.sign === "function";
}

export type KreivoTx =
  | KreivoApiCall
  | EventsContractCall
  | TicketsContractCall

export type KippuConsumerSettings = {
  client: PolkadotClient;
  apiEndpoint: string;
  eventsContractAddress: AccountId;
  ticketsContractAddress: AccountId;
  storeId?: number;
  merchantId?: number;
};
export type KippuConfig = Required<
  ClientConfig<KippuConsumerSettings>
>;
export type KippuAccountProvider = KippuConfig["accountProvider"];

export enum TOKEN {
  MERCHANT_ID = "MerchantId",
  ACCUNT_PROVIDER = "AccountProvider",
  SETTINGS = "KippuConsumerSetttings",
  SUBMITTER = "TransactionSubmitter",
  QUEUE = "EventsQueue",
  POLKADOT_CLIENT = "PolkadotClient",
  KREIVO_API = "KreivoApi",
  EVENTS_CONTRACT_ADDRESS = "EventsContractAddress",
  EVENTS_CONTRACT = "EventsContract",
  TICKETS_CONTRACT = "TicketsContract",
}

export type TickettoAttendancePolicy = Enum<{
  Single: undefined;
  Multiple: {
    max: number;
    maybe_until?: bigint;
  };
  Unlimited: {
    maybe_until?: bigint;
  };
}>;

export type TickettoAssetId = Enum<{
  Here: number;
  Sibling: {
    id: number;
    pallet: number;
    index: number;
  };
  External: {
    network: Enum<{
      Polkadot: undefined;
      Kusama: undefined;
      Ethereum: {
        chain_id: bigint;
      };
    }>;
    child?:
    | {
      id: number;
      pallet: number;
      index: number;
    }
    | undefined;
  };
}>;
