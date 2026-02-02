import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/oracle_resolver.tact',
    options: {
        debug: true,
    }
};
