import type { BoundingBox, Point2D } from "@/types/domain";

export function rectToPoints(bbox: BoundingBox): Point2D[] {
  const x2 = bbox.x + bbox.width;
  const y2 = bbox.y + bbox.height;
  return [
    { x: bbox.x, y: bbox.y },
    { x: x2, y: bbox.y },
    { x: x2, y: y2 },
    { x: bbox.x, y: y2 },
  ];
}

export function pointsToTuples(points: Point2D[]): [number, number][] {
  return points.map((p) => [p.x, p.y]);
}

export function tuplesToPoints(points: [number, number][]): Point2D[] {
  return points.map(([x, y]) => ({ x, y }));
}

export function normalizeRect(bbox: BoundingBox): BoundingBox {
  return {
    x: Math.min(bbox.x, bbox.x + bbox.width),
    y: Math.min(bbox.y, bbox.y + bbox.height),
    width: Math.abs(bbox.width),
    height: Math.abs(bbox.height),
  };
}
