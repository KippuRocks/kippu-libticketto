import {
  ChopsticksProvider,
  allHandlers,
} from "@acala-network/chopsticks-core";

import { JsonRpcProvider } from "polkadot-api/ws-provider/web";

// A convenient Polkadot-API JSON-RPC provider.
export function getPapiChopsticksProvider(
  chopsticksProvider: ChopsticksProvider
): JsonRpcProvider {
  return (onMessage: (message: string) => void) => {
    const processResponse =
      (id: string | number, subscription?: string, method?: string) =>
        (error: Error | null, result: any) => {
          if (error) {
            return;
          }

          const response = {
            jsonrpc: "2.0",
            ...(subscription
              ? {
                method,
                params: { subscription, result },
              }
              : { id, result }),
          };

          onMessage(JSON.stringify(response));
        };

    return {
      async send(message) {
        const rpcRequest = JSON.parse(message);

        const callback = processResponse(rpcRequest.id);
        const handlerFn = allHandlers[rpcRequest.method];

        switch (handlerFn.length) {
          case 1:
          case 2: {
            // Not expecting subscription
            return chopsticksProvider
              .send(rpcRequest.method, rpcRequest.params)
              .then((response) => callback(null, response))
              .catch((error) => callback(error, null));
          }
          case 3:
            // Unfollow method receives three methods, but it doesn't
            // really means this return a "subscriptionId".
            if (rpcRequest.method === "chainHead_v1_unfollow") {
              return chopsticksProvider
                .send(rpcRequest.method, rpcRequest.params)
                .then((response) => callback(null, response))
                .catch((error) => callback(error, null));
            }

            // Expecting a subscription
            const subscription = await chopsticksProvider.send<string>(
              rpcRequest.method,
              rpcRequest.params,
              false,
              {
                callback: (error, result) =>
                  processResponse(
                    rpcRequest.id,
                    subscription,
                    rpcRequest.method
                  )(error, result),
                type: rpcRequest.method,
              }
            );

            callback(null, subscription);
        }
      },
      async disconnect() {
        await chopsticksProvider.disconnect();
        await chopsticksProvider.chain.close();
      },
    };
  };
}
