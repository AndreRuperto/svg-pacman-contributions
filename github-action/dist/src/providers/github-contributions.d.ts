import { Contribution, StoreType } from '../types.js';
export declare function fetchGithubContributionsGraphQL(store: StoreType, username: string, token: string): Promise<Contribution[]>;
