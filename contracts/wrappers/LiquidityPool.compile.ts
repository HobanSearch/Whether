import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/liquidity_pool.tact',
    options: {
        debug: true,
    },
};
