import { KippuAccountProvider, KreivoTx } from "../../../src/types.ts";

import { KippuPAPIConsumer } from "../../../src/index.ts";
import { PolkadotClient } from "polkadot-api";
import { TickettoClientBuilder } from "@ticketto/protocol";
import { kreivo } from "@kippurocks/papi-descriptors";

export async function getTickettoClient(
  client: PolkadotClient,
  accountProvider: KippuAccountProvider,
  apiEndpoint = "https://api.kippu.rocks"
) {
  const api = client.getTypedApi(kreivo);

  const eventsContractAddress =
    await api.query.ContractsStore.ContractAccount.getValue([0, 0n], {
      at: "best",
    });
  const ticketsContractAddress =
    await api.query.ContractsStore.ContractAccount.getValue([1, 0n], {
      at: "best",
    });
  const merchantId = await api.query.ContractsStore.ContractMerchantId.getValue(
    eventsContractAddress!,
    { at: "best" }
  );

  return new TickettoClientBuilder()
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
