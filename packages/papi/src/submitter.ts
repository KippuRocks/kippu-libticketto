import { inject, injectable } from "inversify";
import { KippuAccountProvider, KreivoApi, KreivoTx, TOKEN } from "./types.ts";
import { Binary, PolkadotClient } from "polkadot-api";
import { Bytes } from '@polkadot-api/substrate-bindings';

@injectable()
export class TransactionSubmitter {
  constructor(
    @inject(TOKEN.POLKADOT_CLIENT) private readonly client: PolkadotClient,
    @inject(TOKEN.KREIVO_API) private readonly api: KreivoApi,
    @inject(TOKEN.ACCUNT_PROVIDER)
    private readonly accountProvider: KippuAccountProvider
  ) { }

  signTx(tx: KreivoTx) {
    return this.accountProvider.sign(tx);
  }

  async quickSubmit(tx: Binary) {
    // Note that the signer returns a `Vec<u8>` that 
    // contains the encoded extrinsic, and not the 
    // encoded extrinsic itself. We need to decode it
    // to pass it to the validator method.
    const extrinsicBytes = Bytes.dec()(tx.asBytes());

    let result: Awaited<ReturnType<(typeof this.api.apis.BlockBuilder.apply_extrinsic)>>;
    try {
      result = await this.api.apis
        .BlockBuilder.apply_extrinsic(Binary.fromBytes(extrinsicBytes));
    } catch (cause) {
      throw new Error("ClientError", { cause });
    }

    if (!result.success) {
      throw new Error("InvalidTransaction");
    }
    if (!result.value.success) {
      throw result.value.value;
    }

    const { resolve, reject, promise } = Promise.withResolvers<void>();

    this.client.submitAndWatch(tx.asHex()).subscribe({
      next(value) {
        switch (value.type) {
          case "broadcasted":
            return resolve();
        }
      },
      error(err) {
        return reject(err);
      },
    });

    return promise;
  }

  async signAndSubmit(tx: KreivoTx) {
    const extrinsic = Binary.fromBytes(
      await this.accountProvider.sign(tx)
    );

    // const queue = this.queue;
    const { resolve, reject, promise } = Promise.withResolvers<void>();

    this.client.submitAndWatch(extrinsic.asHex()).subscribe({
      next(value) {
        switch (value.type) {
          case "txBestBlocksState":
            // TODO: Handle passing events to the client queue.

            // // to get the events and deposit them on the events queue
            // for (const event of value.events) {
            //   switch (event.type) {
            //     case "Contracts":
            //       switch (event.value.type) {
            //         case "ContractEmitted":
            //           queue.depositEvent({
            //             type: "AttendanceMarked",
            //             id: BigInt(0),
            //             issuer: 0,
            //             owner: "",
            //             time: BigInt(Date.now()),
            //           });
            //           break;
            //       }
            //       break;
            //   }
            // }

            return resolve();
        }
      },
      error(err) {
        return reject(err);
      },
    });

    return promise;
  }
}
