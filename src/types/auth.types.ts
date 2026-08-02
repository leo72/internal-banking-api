/** Minimal employee identity exposed to authenticated request handlers. */
export type AuthenticatedEmployee = Readonly<{
  id: string;
  name: string;
}>;
