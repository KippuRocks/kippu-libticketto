import { WebAuthnEmulator } from "nid-webauthn-emulator";

// Origin that will be attached to the emulator (only affects RP id handling)
const ORIGIN = "https://example.com";

export function mockWebAuthnEmulation(origin = ORIGIN): WebAuthnEmulator {
  const emulator = new WebAuthnEmulator();

  if (!("credentials" in navigator)) {
    Object.defineProperty((globalThis as any).navigator, "credentials", {
      configurable: true,
      value: {
        /** Polyfill for `navigator.credentials.create` */
        create: async (options: CredentialCreationOptions) =>
          emulator.create(origin, options),
        /** Polyfill for `navigator.credentials.get` */
        get: async (options: CredentialRequestOptions) =>
          emulator.get(origin, options),
      },
    });
  }

  return emulator;
}
