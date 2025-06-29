import { inject, injectable } from "inversify";
import {
  TickettoAssetId,
  TickettoAttendancePolicy,
  KreivoApi,
  TOKEN,
} from "./types.ts";

import {
  AttendancePolicy,
  AttendancePolicyType,
  EventState,
  LineItemPrice,
} from "@ticketto/types";

@injectable()
export class TickettoModelConverter {
  constructor(@inject(TOKEN.KREIVO_API) private readonly api: KreivoApi) {}

  intoTickettoAttendancePolicy(
    attendancePolicy: TickettoAttendancePolicy
  ): AttendancePolicy {
    switch (attendancePolicy.type) {
      case "Single": {
        return {
          type: AttendancePolicyType.Single,
        };
      }
      case "Multiple": {
        return {
          type: AttendancePolicyType.Multiple,
          max: attendancePolicy.value.max,
          until: attendancePolicy.value.maybe_until,
        };
      }
      case "Unlimited": {
        return {
          type: AttendancePolicyType.Unlimited,
          until: attendancePolicy.value.maybe_until,
        };
      }
    }
  }

  intoTickettoEventState(
    state: "Created" | "Sales" | "Ongoing" | "Finished"
  ): EventState {
    switch (state) {
      case "Created":
        return 0;
      case "Sales":
        return 1;
      case "Ongoing":
        return 2;
      case "Finished":
        return 3;
    }
  }

  assetIdOf(id: TickettoAssetId): number {
    switch (id.type) {
      case "Here":
        return id.value;
      case "Sibling":
        return id.value.index;
      case "External":
        return id.value.child?.index ?? 0;
    }
  }

  async assetMetadata(id: TickettoAssetId): Promise<LineItemPrice["asset"]> {
    const assetMetadata = await this.api.query.Assets.Metadata.getValue(id);

    if (!assetMetadata) {
      throw new Error("AssetNotFound");
    }

    return {
      id: this.assetIdOf(id),
      code: assetMetadata.symbol.asText(),
      decimals: assetMetadata.decimals,
    };
  }
}
