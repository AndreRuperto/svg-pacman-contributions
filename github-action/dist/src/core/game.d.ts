import { StoreType, GhostName } from '../types.js';
export declare const determineGhostName: (index: number) => GhostName;
export declare function resetFrame(): void;
export declare const Game: {
    startGame: (store: StoreType) => Promise<void>;
    stopGame: (store: StoreType) => Promise<void>;
};
