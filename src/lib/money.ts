const MINOR_UNITS_PER_MAJOR_UNIT = 100n;

export const MONEY_AMOUNT_PATTERN =
  "^(0|[1-9][0-9]{0,14})(\\.[0-9]{1,2})?$";

const MONEY_AMOUNT_REGEXP = new RegExp(MONEY_AMOUNT_PATTERN);

/** Converts a validated decimal amount string into integer minor units. */
export function parseMoneyToMinorUnits(amount: string): bigint {
  if (!MONEY_AMOUNT_REGEXP.test(amount)) {
    throw new RangeError("Invalid monetary amount");
  }

  const decimalIndex = amount.indexOf(".");
  const wholePart =
    decimalIndex === -1 ? amount : amount.slice(0, decimalIndex);
  const fractionalPart =
    decimalIndex === -1 ? "" : amount.slice(decimalIndex + 1);
  const paddedFractionalPart = fractionalPart.padEnd(2, "0");

  return (
    BigInt(wholePart) * MINOR_UNITS_PER_MAJOR_UNIT +
    BigInt(paddedFractionalPart || "0")
  );
}

/** Formats integer minor units as a fixed two-decimal API amount string. */
export function formatMinorUnits(amountMinor: bigint): string {
  const isNegative = amountMinor < 0n;
  const absoluteAmount = isNegative ? -amountMinor : amountMinor;
  const wholePart = absoluteAmount / MINOR_UNITS_PER_MAJOR_UNIT;
  const fractionalPart = absoluteAmount % MINOR_UNITS_PER_MAJOR_UNIT;

  return `${isNegative ? "-" : ""}${wholePart}.${fractionalPart
    .toString()
    .padStart(2, "0")}`;
}
