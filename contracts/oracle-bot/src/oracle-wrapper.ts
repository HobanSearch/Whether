/**
 * OracleResolver wrapper - imports from parent build directory
 * This file provides type-safe access to the OracleResolver contract wrapper
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const oracleModule = require('../../build/OracleResolver/tact_OracleResolver');

export const OracleResolver = oracleModule.OracleResolver;
export type OracleResolver = typeof oracleModule.OracleResolver.prototype;
