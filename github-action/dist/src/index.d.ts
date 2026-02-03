import { Config, StoreType } from './types.js';
export declare class PacmanRenderer {
    store: StoreType;
    conf: Config;
    constructor(conf: Config);
    start(): Promise<StoreType>;
    stop(): void;
}
