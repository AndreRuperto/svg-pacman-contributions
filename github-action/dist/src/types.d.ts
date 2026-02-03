export type Point2d = {
    x: number;
    y: number;
    direction?: 'right' | 'left' | 'up' | 'down';
};
export type ContributionLevel = 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';
export declare enum PlayerStyle {
    CONSERVATIVE = "conservador",
    AGGRESSIVE = "agressivo",
    OPPORTUNISTIC = "oportunista"
}
export interface Contribution {
    date: Date;
    count: number;
    color: string;
    level: ContributionLevel;
}
export interface Pacman {
    x: number;
    y: number;
    direction: 'right' | 'left' | 'up' | 'down';
    points: number;
    totalPoints: number;
    deadRemainingDuration: number;
    powerupRemainingDuration: number;
    recentPositions: string[];
    target?: Point2d;
}
export type GhostName = 'blinky' | 'clyde' | 'inky' | 'pinky' | 'eyes';
export interface Ghost {
    x: number;
    y: number;
    name: GhostName;
    originalName?: GhostName;
    scared: boolean;
    direction: 'right' | 'left' | 'up' | 'down';
    target?: Point2d;
    inHouse?: boolean;
    isRespawning?: boolean;
    respawnCounter?: number;
    immunityFrames?: number;
    justReleasedFromHouse?: boolean;
    confusionFrames?: number;
}
export interface GridCell {
    commitsCount: number;
    color: string;
    level: ContributionLevel;
}
export interface GameStatistics {
    totalPoints: number;
    ghostsEaten: number;
    deaths: number;
    powerUpsCollected: number;
    highestGhostCombo: number;
    efficiencyMultiplier: number;
    timeBonus: number;
    lastPoints?: number;
    pointsFromContributions?: number;
    pointsFromGhosts?: number;
    pointsFromPowerUps?: number;
}
export interface StoreType {
    frameCount: number;
    contributions: Contribution[];
    pacman: Pacman;
    ghosts: Ghost[];
    grid: GridCell[][];
    monthLabels: string[];
    pacmanMouthOpen: boolean;
    gameInterval: number;
    gameHistory: {
        pacman: Pacman;
        ghosts: Ghost[];
        grid: GridCell[][];
    }[];
    config: Config;
    useGithubThemeColor: boolean;
    __loggedGhosts?: Set<string>;
    moveCounter?: number;
    deathCount?: number;
    statistics?: GameStatistics;
}
export interface Config {
    platform: 'github';
    username: string;
    canvas: HTMLCanvasElement;
    outputFormat: 'canvas' | 'svg';
    svgCallback: (blobUrl: string) => void;
    gameOverCallback: () => void;
    gameTheme: ThemeKeys;
    gameSpeed: number;
    enableSounds: boolean;
    githubSettings?: {
        accessToken: string;
    };
    playerStyle?: PlayerStyle;
    joinRanking?: boolean;
}
export type ThemeKeys = 'github' | 'github-dark';
export interface GameTheme {
    textColor: string;
    gridBackground: string;
    wallColor: string;
    intensityColors: string[];
}
export interface AnimationData {
    keyTimes: string;
    values: string;
}
