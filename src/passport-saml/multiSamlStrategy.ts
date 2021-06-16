import { SAML } from "../node-saml";
import { AbstractStrategy } from "./strategy";
import type { Request } from "express";
import {
  AuthenticateOptions,
  MultiSamlConfig,
  RequestWithUser,
  SamlConfig,
  VerifyWithoutRequest,
  VerifyWithRequest,
} from "./types";

export class MultiSamlStrategy extends AbstractStrategy {
  static readonly newSamlProviderOnConstruct = false;
  _options: SamlConfig & MultiSamlConfig;

  constructor(options: MultiSamlConfig, verify: VerifyWithRequest);
  constructor(options: MultiSamlConfig, verify: VerifyWithoutRequest);
  constructor(options: MultiSamlConfig, verify: never) {
    if (!options || typeof options.getSamlOptions !== "function") {
      throw new Error("Please provide a getSamlOptions function");
    }

    // Force the type on this since we've disabled `newOnConstruct`
    // so the `SAML` constructor will not be called at this time
    // and there are defaults for all `strategy`-required options.
    const samlConfig = {
      ...options,
    } as SamlConfig & MultiSamlConfig;

    super(samlConfig, verify);
    this._options = samlConfig;
  }

  authenticate(req: Request, options: AuthenticateOptions): void {
    this._options.getSamlOptions(req, (err, samlOptions) => {
      if (err) {
        return this.error(err);
      }

      const samlService = new SAML({ ...this._options, ...samlOptions });
      const strategy = Object.assign({}, this, { _saml: samlService });
      Object.setPrototypeOf(strategy, this);
      super.authenticate.call(strategy, req, options);
    });
  }

  logout(
    req: RequestWithUser,
    callback: (err: Error | null, url?: string | null | undefined) => void
  ) {
    this._options.getSamlOptions(req, (err, samlOptions) => {
      if (err) {
        return callback(err);
      }

      const samlService = new SAML(Object.assign({}, this._options, samlOptions));
      const strategy = Object.assign({}, this, { _saml: samlService });
      Object.setPrototypeOf(strategy, this);
      super.logout.call(strategy, req, callback);
    });
  }

  generateServiceProviderMetadata(
    req: Request,
    decryptionCert: string | null,
    signingCert: string | null,
    callback: (err: Error | null, metadata?: string) => void
  ) {
    if (typeof callback !== "function") {
      throw new Error("Metadata can't be provided synchronously for MultiSamlStrategy.");
    }

    return this._options.getSamlOptions(req, (err, samlOptions) => {
      if (err) {
        return callback(err);
      }

      const samlService = new SAML(Object.assign({}, this._options, samlOptions));
      const strategy = Object.assign({}, this, { _saml: samlService });
      Object.setPrototypeOf(strategy, this);
      return callback(
        null,
        this._generateServiceProviderMetadata.call(strategy, decryptionCert, signingCert)
      );
    });
  }

  // This is reduntant, but helps with testing
  error(err: Error): void {
    super.error(err);
  }
}
