import { KippuAccountProvider, KreivoTx } from "../../../src/types.ts";

import { KippuPAPIConsumer } from "../../../src/index.ts";
import { PolkadotClient } from "polkadot-api";
import { TickettoClientBuilder } from "@ticketto/protocol";
import { kreivo } from "@polkadot-api/descriptors";

export async function getTickettoClient(
  client: PolkadotClient,
  accountProvider: KippuAccountProvider,
  apiEndpoint = "https://api.kippu.rocks"
) {
  const api = client.getTypedApi(kreivo);

  const eventsContractAddress =
    await api.query.ContractsStore.ContractAccount.getValue([0, 0n]);
  const ticketsContractAddress =
    await api.query.ContractsStore.ContractAccount.getValue([1, 0n]);
  const merchantId =
    await api.query.ContractsStore.ContractMerchantId.getValue(eventsContractAddress!);

  return new TickettoClientBuilder<KreivoTx>()
    .withConsumer(KippuPAPIConsumer)
    .withConfig({
      accountProvider,
      consumerSettings: {
        client,
        apiEndpoint,
        eventsContractAddress,
        ticketsContractAddress,
        merchantId,
      },
    })
    .build();
}
