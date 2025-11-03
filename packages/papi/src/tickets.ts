import { AccountId, EventId, Ticket, TicketId } from "@ticketto/types";
import { TicketsCalls, TicketsStorage } from "@ticketto/protocol";
import { inject } from "inversify";
import {
  KippuAccountProvider,
  KreivoApi,
  TicketsContract,
  TOKEN,
} from "./types.ts";
import { TransactionSubmitter } from "./submitter.ts";
import { Binary } from "polkadot-api";
import { TickettoModelConverter } from "./tickettoModel.ts";
import { Gas } from "@polkadot-api/sdk-ink";

export class KippuTicketsCalls implements TicketsCalls {
  constructor(
    @inject(TOKEN.ACCUNT_PROVIDER)
    private readonly accountProvider: KippuAccountProvider,
    @inject(TOKEN.KREIVO_API) private readonly api: KreivoApi,
    @inject(TOKEN.TICKETS_CONTRACT) private readonly tickets: TicketsContract,
    @inject(TOKEN.SUBMITTER) private readonly submitter: TransactionSubmitter,
    @inject(TOKEN.MERCHANT_ID) private readonly merchantId: number
  ) {}

  async issue(eventId: EventId) {
    const result = await this.tickets.query("issue_ticket", {
      origin: this.accountProvider.getAccountId(),
      data: {
        event_id: eventId,
      },
    });

    if (!result.success) {
      throw new Error(result.value.type);
    }

    let ticketId = result.value.response;

    const tx = this.tickets.send("issue_ticket", {
      data: {
        event_id: eventId,
      },
      gasLimit: result.value.gasRequired,
      storageDepositLimit: result.value.storageDeposit,
    });

    await this.submitter.signAndSubmit(tx);
    return ticketId;
  }

  submitAttendanceCall(input: Uint8Array) {
    return this.submitter.quickSubmit(Binary.fromBytes(input));
  }

  async initiatePendingTransfer(
    eventId: EventId,
    id: TicketId,
    beneficiary: AccountId
  ) {
    const data = {
      event_id: eventId,
      ticket_id: id,
      beneficiary,
    };

    const result = await this.tickets.query("initiate_pending_transfer", {
      origin: this.accountProvider.getAccountId(),
      data,
    });

    if (!result.success) {
      throw new Error(result.value.type);
    }

    const tx = this.tickets.send("initiate_pending_transfer", {
      data,
      gasLimit: result.value.gasRequired,
      storageDepositLimit: result.value.storageDeposit,
    });

    await this.submitter.signAndSubmit(tx);
  }

  async acceptPendingTransfer(eventId: EventId, id: TicketId) {
    const data = {
      event_id: eventId,
      ticket_id: id,
    };

    const result = await this.tickets.query("accept_pending_transfer", {
      origin: this.accountProvider.getAccountId(),
      data,
    });

    if (!result.success) {
      throw new Error(result.value.type);
    }

    const tx = this.tickets.send("accept_pending_transfer", {
      data,
      gasLimit: result.value.gasRequired,
      storageDepositLimit: result.value.storageDeposit,
    });

    await this.submitter.signAndSubmit(tx);
  }

  async cancelPendingTransfer(eventId: EventId, id: TicketId) {
    const data = {
      event_id: eventId,
      ticket_id: id,
    };

    const result = await this.tickets.query("cancel_pending_transfer", {
      origin: this.accountProvider.getAccountId(),
      data,
    });

    if (!result.success) {
      throw new Error(result.value.type);
    }

    const tx = this.tickets.send("cancel_pending_transfer", {
      data,
      gasLimit: result.value.gasRequired,
      storageDepositLimit: result.value.storageDeposit,
    });

    await this.submitter.signAndSubmit(tx);
  }

  sell(_issuer: EventId, _id: TicketId, _receiver: AccountId): Promise<void> {
    // TODO: We'll implement this øn the second stage of the project.
    //
    // This is intended for reselling, and requires some changes in the protocol library
    // definition.
    throw new Error("Method not implemented.");
  }

  async withdrawSell(_eventId: EventId, _id: TicketId) {
    // TODO: We'll implement this øn the second stage of the project.
    //
    // This needs a change in `pallet-listings` to allow clearing the price of an item.
    throw new Error("Method not implemented.");
  }

  async buy(issuer: EventId, id: TicketId) {
    const orderId = await this.api.query.Orders.NextOrderId.getValue();

    // Quickly creates the cart. We'll figure out the process of handling the cart
    // in a further protocol extension.
    await this.submitter.signAndSubmit(
      this.api.tx.Orders.create_cart({
        maybe_items: [[[[2, issuer], id], undefined]],
      })
    );

    // Checkout and pay. This is the moment.
    await this.submitter.signAndSubmit(
      this.api.tx.Utility.batch({
        calls: [
          this.api.tx.Orders.checkout({ order_id: orderId }).decodedCall,
          this.api.tx.Orders.pay({ order_id: orderId }).decodedCall,
        ],
      })
    );
  }
}

export class KippuTicketsStorage implements TicketsStorage {
  constructor(
    @inject(TOKEN.ACCUNT_PROVIDER)
    private readonly accountProvider: KippuAccountProvider,
    @inject(TOKEN.KREIVO_API) private readonly api: KreivoApi,
    @inject(TOKEN.TICKETS_CONTRACT) private readonly tickets: TicketsContract,
    @inject(TOKEN.SUBMITTER) private readonly submitter: TransactionSubmitter,
    @inject(TOKEN.MERCHANT_ID) private readonly merchantId: number,
    @inject(TickettoModelConverter)
    private readonly converter: TickettoModelConverter
  ) {}

  async get(eventId: EventId, id: TicketId) {
    const response = await this.tickets.query("get", {
      origin: this.accountProvider.getAccountId(),
      data: {
        event_id: eventId,
        ticket_id: id,
      },
    });

    if (!response.success || response.value.response === undefined) {
      return undefined;
    }

    const ticket = response.value.response;

    return {
      id,
      eventId,
      attendancePolicy: this.converter.intoTickettoAttendancePolicy(
        ticket.attendance_policy
      ),
      attendances: new Array(ticket.attendances.count).fill(
        ticket.attendances.last
      ),
      restrictions: {
        cannotResale: ticket.restrictions.cannot_resale,
        cannotTransfer: ticket.restrictions.cannot_transfer,
      },
      price: ticket.price
        ? {
            amount: ticket.price.amount,
            asset: await this.converter.assetMetadata(ticket.price.asset),
          }
        : undefined,
    } as Ticket;
  }

  async all(eventId: EventId) {
    const items = await this.api.query.ListingsCatalog.Item.getEntries([
      this.merchantId,
      eventId,
    ]);

    return Promise.all(
      items.map(({ keyArgs: [[, eventId], id] }) => this.get(eventId, id))
    ).then((ts) => ts.filter((t) => t !== undefined));
  }

  async ticketHolderOf(who: AccountId, eventId?: EventId) {
    const items =
      eventId !== undefined
        ? await this.api.query.ListingsCatalog.Account.getEntries(who, [
            this.merchantId,
            eventId,
          ])
        : await this.api.query.ListingsCatalog.Account.getEntries(who);

    return Promise.all(
      items.map(({ keyArgs: [, [m, eventId], id] }) =>
        m === this.merchantId ? this.get(eventId, id) : undefined
      )
    ).then((ts) => ts.filter((t) => t !== undefined));
  }

  async attendances(eventId: EventId, id: TicketId) {
    const data = {
      event_id: eventId,
      ticket_id: id,
    };

    const response = await this.tickets.query("attendances", {
      origin: this.accountProvider.getAccountId(),
      data,
    });

    if (!response.success) {
      throw new Error(response.value.type);
    }

    return new Array(response.value.response.count).fill(
      response.value.response.last
    );
  }

  async pendingTransfersFor(who: AccountId): Promise<Ticket[]> {
    // TODO: This implementation definitely needs the indexer. Until
    // we got it, it's better not to deal with it.
    throw new Error("Method not implemented");
  }

  async attendanceRequest(eventId: EventId, id: TicketId) {
    // This implementation doesn't care about weight limits since it's
    // already too small.
    //
    // TODO: Ideally, sign this using the offline signer.
    const gasLimit: Gas = {
      ref_time: 603608583n,
      proof_size: 62239n,
    };

    return this.submitter.signTx(
      this.tickets.send("mark_attendance", {
        data: {
          event_id: eventId,
          id,
        },
        gasLimit,
        storageDepositLimit: 1n * 10n ** 12n,
      })
    );
  }
}
