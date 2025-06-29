import { AttendancePolicyType, Event } from "@ticketto/types";

export const EVENT: Omit<Event, "id" | "state" | "organiser"> = {
  name: "New Age Event",
  capacity: 100n,
  class: {
    attendancePolicy: {
      type: AttendancePolicyType.Single,
    },
    ticketprice: {
      amount: 10n ** 6n,
      asset: {
        code: "dUSD",
        decimals: 6,
        id: 50000002,
      },
    },
    ticketRestrictions: {
      cannotResale: false,
      cannotTransfer: false,
    },
  },
};
