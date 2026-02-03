import { Point2d } from '../types.js';
export declare const MovementUtils: {
    getValidMoves: (x: number, y: number) => [number, number][];
    calculateDistance: (x1: number, y1: number, x2: number, y2: number) => number;
    /**
     * Dijkstra de grade 4-direções.
     * Retorna o PRÓXIMO passo (não a rota inteira) ou null se não houver.
     */
    findNextStepDijkstra(start: Point2d, target: Point2d): Point2d | null;
};
