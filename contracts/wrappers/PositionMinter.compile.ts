import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/position_minter.tact',
    options: {
        debug: true,
    }
};
