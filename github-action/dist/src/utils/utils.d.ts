import type { StoreType, GameTheme, ContributionLevel, Contribution } from '../types.js';
export declare const getCurrentTheme: (store: StoreType) => GameTheme;
export declare const levelToIndex: (level: ContributionLevel) => number;
export declare const buildGrid: (store: StoreType) => void;
export declare const buildMonthLabels: (store: StoreType) => void;
export declare const createGridFromData: (store: StoreType) => import("../types.js").GridCell[][];
export declare const printArena: (store: StoreType) => void;
export declare const printArenaAsHTML: (store: StoreType) => void;
export declare const Utils: {
    getGitlabContribution: (store: StoreType) => Promise<{
        date: Date;
        count: number;
        color: string;
        level: "NONE";
    }[]>;
    getGithubContribution: (store: StoreType) => Promise<Contribution[]>;
    getCurrentTheme: (store: StoreType) => GameTheme;
    buildGrid: (store: StoreType) => void;
    buildMonthLabels: (store: StoreType) => void;
    createGridFromData: (store: StoreType) => import("../types.js").GridCell[][];
    printArena: (store: StoreType) => void;
    levelToIndex: (level: ContributionLevel) => number;
    printArenaAsHTML: (store: StoreType) => void;
};
