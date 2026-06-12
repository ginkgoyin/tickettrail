import { describe, expect, it } from "vitest";
import { resolveJourneyDestinationAutofill } from "../src/lib/journeyDestinationAutofill";

describe("resolveJourneyDestinationAutofill", () => {
  it("fills an empty destination from the current suggestion", () => {
    expect(
      resolveJourneyDestinationAutofill(
        {
          destination: "",
          previousAutoFilledDestination: "",
          manuallyEdited: false,
        },
        "Qingdao",
      ),
    ).toEqual({
      destination: "Qingdao",
      previousAutoFilledDestination: "Qingdao",
    });
  });

  it("updates the destination when the current value was previously auto-filled", () => {
    expect(
      resolveJourneyDestinationAutofill(
        {
          destination: "Qingdao",
          previousAutoFilledDestination: "Qingdao",
          manuallyEdited: false,
        },
        "Hobart",
      ),
    ).toEqual({
      destination: "Hobart",
      previousAutoFilledDestination: "Hobart",
    });
  });

  it("does not overwrite a manually edited destination", () => {
    expect(
      resolveJourneyDestinationAutofill(
        {
          destination: "Tokyo + Kyoto",
          previousAutoFilledDestination: "Narita",
          manuallyEdited: true,
        },
        "Osaka",
      ),
    ).toEqual({
      destination: "Tokyo + Kyoto",
      previousAutoFilledDestination: "Narita",
    });
  });

  it("clears the destination when tickets are removed and the current value was auto-filled", () => {
    expect(
      resolveJourneyDestinationAutofill(
        {
          destination: "Hobart",
          previousAutoFilledDestination: "Hobart",
          manuallyEdited: false,
        },
        "",
      ),
    ).toEqual({
      destination: "",
      previousAutoFilledDestination: "",
    });
  });

  it("keeps the destination when tickets are removed and the current value was manually edited", () => {
    expect(
      resolveJourneyDestinationAutofill(
        {
          destination: "Tasmania road trip",
          previousAutoFilledDestination: "Hobart",
          manuallyEdited: true,
        },
        "",
      ),
    ).toEqual({
      destination: "Tasmania road trip",
      previousAutoFilledDestination: "Hobart",
    });
  });
});
