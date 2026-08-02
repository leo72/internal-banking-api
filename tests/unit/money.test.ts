import {
  formatMinorUnits,
  parseMoneyToMinorUnits,
} from "../../src/lib/money.js";

describe("money conversion", () => {
  it.each([
    ["0", 0n],
    ["1", 100n],
    ["12.3", 1_230n],
    ["12.34", 1_234n],
    ["999999999999999.99", 99_999_999_999_999_999n],
  ])("parses %s without floating-point arithmetic", (amount, expected) => {
    expect(parseMoneyToMinorUnits(amount)).toBe(expected);
  });

  it.each(["-1.00", "01.00", "1.234", "1.", ".50", "1000000000000000"])(
    "rejects invalid amount %s",
    (amount) => {
      expect(() => parseMoneyToMinorUnits(amount)).toThrow(
        "Invalid monetary amount",
      );
    },
  );

  it("formats minor units with exactly two decimal places", () => {
    expect(formatMinorUnits(0n)).toBe("0.00");
    expect(formatMinorUnits(1n)).toBe("0.01");
    expect(formatMinorUnits(1_230n)).toBe("12.30");
    expect(formatMinorUnits(-1_230n)).toBe("-12.30");
  });
});
