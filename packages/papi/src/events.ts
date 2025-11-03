import {
  AccountId,
  AttendancePolicy,
  AttendancePolicyType,
  DateRange,
  Event,
  EventId,
} from "@ticketto/types";
import { ss58Address } from "@polkadot-labs/hdkd-helpers";

import { EventsCalls, EventsStorage } from "@ticketto/protocol";
import {
  currency,
  EventContractTypes,
  EventsContract,
  KippuAccountProvider,
  KreivoApi,
  TickettoAttendancePolicy,
  TOKEN,
} from "./types.ts";
import { inject, injectable } from "inversify";
import { Binary, PolkadotClient } from "polkadot-api";
import { TransactionSubmitter } from "./submitter.ts";
import { TickettoModelConverter } from "./tickettoModel.ts";

@injectable()
export class KippuEventsCalls implements EventsCalls {
  constructor(
    @inject(TOKEN.ACCUNT_PROVIDER)
    private readonly accountProvider: KippuAccountProvider,
    @inject(TOKEN.POLKADOT_CLIENT) private readonly client: PolkadotClient,
    @inject(TOKEN.EVENTS_CONTRACT) private readonly contract: EventsContract,
    @inject(TOKEN.SUBMITTER) private readonly submitter: TransactionSubmitter
  ) {}

  private intoContractAttendancePolicy(
    attendancePolicy: AttendancePolicy
  ): TickettoAttendancePolicy {
    switch (attendancePolicy.type) {
      case AttendancePolicyType.Single:
        return {
          type: "Single",
          value: undefined,
        };
      case AttendancePolicyType.Multiple: {
        return {
          type: "Multiple",
          value: {
            max: attendancePolicy.max,
            maybe_until: attendancePolicy.until,
          },
        };
      }
      case AttendancePolicyType.Unlimited: {
        return {
          type: "Unlimited",
          value: {
            maybe_until: attendancePolicy.until,
          },
        };
      }
    }
  }

  async createEvent(event: Omit<Event, "id">) {
    const origin = this.accountProvider.getAccountId();
    const { UNIT } = await currency(this.client);

    const data: EventContractTypes["messages"]["create_event"]["message"] = {
      name: Binary.fromText(event.name),
      capacity: BigInt(event.capacity),
      ticket_class: {
        attendance_policy: this.intoContractAttendancePolicy(
          event.class.attendancePolicy
        ),
        price: {
          asset: {
            type: "Sibling",
            value: {
              id: 1000, // Asset Hub
              pallet: 50, // pallet_assets
              index: event.class.ticketprice.asset.id,
            },
          },
          amount: BigInt(event.class.ticketprice.amount),
        },
        maybe_restrictions: {
          cannot_resale: event.class.ticketRestrictions.cannotResale,
          cannot_transfer: event.class.ticketRestrictions.cannotTransfer,
        },
      },
      maybe_dates: event.dates,
    };

    const result = await this.contract.query("create_event", {
      origin,
      data,
      value: UNIT,
    });

    if (!result.success) {
      throw new Error("CannotCreateEvent");
    }

    const [eventId] = result.value.response;

    const tx = this.contract.send("create_event", {
      origin,
      data,
      value: UNIT,
      gasLimit: result.value.gasRequired,
    });

    await this.submitter.signAndSubmit(tx);
    return eventId;
  }

  async update(id: EventId, event: Partial<Omit<Event, "id">>) {
    const origin = this.accountProvider.getAccountId();

    const data: EventContractTypes["messages"]["update"]["message"] = {
      event_id: id,
      maybe_name: event.name ? Binary.fromText(event.name) : undefined,
      maybe_capacity: event.capacity ? BigInt(event.capacity) : undefined,
      maybe_ticket_class: event.class
        ? {
            attendance_policy: this.intoContractAttendancePolicy(
              event.class.attendancePolicy
            ),
            price: {
              asset: {
                type: "Sibling",
                value: {
                  id: 1000, // Asset Hub
                  pallet: 50, // pallet_assets
                  index: event.class.ticketprice.asset.id,
                },
              },
              amount: BigInt(event.class.ticketprice.amount),
            },
            maybe_restrictions: {
              cannot_resale: event.class.ticketRestrictions.cannotResale,
              cannot_transfer: event.class.ticketRestrictions.cannotTransfer,
            },
          }
        : undefined,
      maybe_dates: event.dates,
    };

    const result = await this.contract.query("update", {
      origin,
      data,
    });

    if (!result.success) {
      throw new Error("CannotUpdateEvent");
    }

    const tx = this.contract.send("update", {
      origin,
      data,
      gasLimit: result.value.gasRequired,
    });

    await this.submitter.signAndSubmit(tx);
  }

  async bumpState(id: EventId) {
    const origin = this.accountProvider.getAccountId();

    const result = await this.contract.query("bump_state", {
      origin,
      data: {
        event_id: id,
      },
    });

    if (!result.success) {
      throw new Error(result.value.type);
    }

    const tx = this.contract.send("bump_state", {
      origin,
      data: {
        event_id: id,
      },
      gasLimit: result.value.gasRequired,
    });

    await this.submitter.signAndSubmit(tx);
  }

  transferOrganiser(_id: EventId, _newOrganiser: AccountId): Promise<void> {
    // TODO: Requires an update in the contract.
    //
    // Won't do for now, because it implies updating the owner of potentially
    // thousands of tickets.
    throw new Error("Method not implemented.");
  }
}

export class KippuEventsStorage implements EventsStorage {
  constructor(
    @inject(TOKEN.ACCUNT_PROVIDER)
    private readonly accountProvider: KippuAccountProvider,
    @inject(TOKEN.KREIVO_API) private readonly api: KreivoApi,
    @inject(TOKEN.EVENTS_CONTRACT_ADDRESS)
    private readonly eventsContractAddress: AccountId,
    @inject(TOKEN.EVENTS_CONTRACT) private readonly contract: EventsContract,
    @inject(TickettoModelConverter)
    private readonly converter: TickettoModelConverter,
    @inject(TOKEN.MERCHANT_ID) private readonly merchantId: number
  ) {}

  async get(id: EventId): Promise<Event | undefined> {
    const response = await this.contract.query("get", {
      origin: this.accountProvider.getAccountId(),
      data: {
        event_id: id,
      },
    });

    if (!response.success) {
      return undefined;
    }

    const event = response.value.response;

    if (event === undefined) {
      return undefined;
    }

    const dates = event.dates
      ? event.dates.map(([s, e]) => [s, e] as DateRange)
      : undefined;
    const date = dates?.[0] ?? undefined;

    return {
      id,
      name: event.name.asText(),
      state: this.converter.intoTickettoEventState(event.state.type),
      ...(dates ? { dates } : {}),
      ...(date ? { date } : {}),
      organiser: ss58Address(event.organiser.asBytes()),
      capacity: event?.capacity ?? 0,
      class: {
        attendancePolicy: this.converter.intoTickettoAttendancePolicy(
          event.class.attendance_policy
        ),
        ticketprice: {
          amount: event.class.price.amount,
          asset: await this.converter.assetMetadata(event.class.price.asset),
        },
        ticketRestrictions: {
          cannotResale: event.class.maybe_restrictions?.cannot_resale || false,
          cannotTransfer:
            event.class.maybe_restrictions?.cannot_transfer || false,
        },
      },
    };
  }

  async all() {
    const events =
      await this.api.query.ListingsCatalog.CollectionAccount.getEntries(
        this.eventsContractAddress
      );

    return Promise.all(
      events.map(({ keyArgs: [_, [__, id]] }) => this.get(id))
    ).then((events) => events.filter((ev) => ev !== undefined));
  }

  async organizerOf(who: AccountId): Promise<Event[]> {
    const events =
      await this.api.query.ListingsCatalog.CollectionAccount.getEntries(
        this.eventsContractAddress
      );

    return Promise.all(
      events.map(({ keyArgs: [_, [m, eventId]] }) =>
        m === this.merchantId ? this.get(eventId) : undefined
      )
    ).then((evs) => evs.filter((ev) => ev?.organiser === who) as Event[]);
  }

  async ticketHolderOf(who: AccountId): Promise<Event[]> {
    const keys = await this.api.query.ListingsCatalog.Account.getEntries(who);

    return Promise.all(
      keys.map(({ keyArgs: [_, [m, eventId]] }) =>
        m === this.merchantId ? this.get(eventId) : undefined
      )
    ).then((evs) => evs.filter((ev) => ev !== undefined) as Event[]);
  }
}
