import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/lp_token.tact',
    options: {
        debug: true,
    },
};
