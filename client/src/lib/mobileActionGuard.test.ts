import { describe, expect, it } from "vitest";
import { shouldAllowAction } from "./mobileActionGuard";

describe("mobile action guard", () => {
  it("allows the first action", () => {
    expect(shouldAllowAction(undefined, 1000, 220)).toBe(true);
  });

  it("blocks repeated actions inside the throttle window", () => {
    expect(shouldAllowAction(1000, 1199, 220)).toBe(false);
  });

  it("allows an action after the throttle window", () => {
    expect(shouldAllowAction(1000, 1220, 220)).toBe(true);
  });
});
