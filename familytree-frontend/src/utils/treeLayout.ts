import type { Edge } from "@xyflow/react";
import type { Person } from "../api/persons";
import type { PersonNodeData, PersonTreeNode } from "../pages/TreeView";

export type SavedPosition = { x: number; y: number };

export function arrangePeople(
  people: Person[],
  edges: Edge[],
  positions: Record<string, SavedPosition>,
  onRename: PersonNodeData["onRename"],
  onDelete: PersonNodeData["onDelete"],
  onAddRelated: PersonNodeData["onAddRelated"],
): PersonTreeNode[] {
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentsByChild.get(edge.target) ?? [];
    parents.push(edge.source);
    parentsByChild.set(edge.target, parents);

    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
  }

  const generations = new Map<string, number>();
  function generationOf(personId: string, path = new Set<string>()): number {
    const existing = generations.get(personId);
    if (existing !== undefined) return existing;
    if (path.has(personId)) return 0;

    const nextPath = new Set(path).add(personId);
    const parents = parentsByChild.get(personId) ?? [];
    const generation = parents.length
      ? Math.max(...parents.map((parentId) => generationOf(parentId, nextPath) + 1))
      : 0;
    generations.set(personId, generation);
    return generation;
  }

  people.forEach((person) => generationOf(person.id));

  const compactedGenerations = new Map(generations);
  const deepestFirst = [...people].sort((left, right) =>
    (generations.get(right.id) ?? 0) - (generations.get(left.id) ?? 0),
  );
  for (const person of deepestFirst) {
    const children = childrenByParent.get(person.id) ?? [];
    if (children.length === 0) continue;

    const lowestChildGeneration = Math.min(...children.map((childId) =>
      compactedGenerations.get(childId) ?? 0,
    ));
    compactedGenerations.set(person.id, Math.max(
      generations.get(person.id) ?? 0,
      lowestChildGeneration - 1,
    ));
  }

  const rows = new Map<number, Person[]>();
  for (const person of people) {
    const rowNumber = compactedGenerations.get(person.id) ?? 0;
    const row = rows.get(rowNumber) ?? [];
    row.push(person);
    rows.set(rowNumber, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  const maxGeneration = Math.max(0, ...rows.keys());
  const horizontalRanks = new Map<string, number>();
  function updateHorizontalRanks(row: Person[]) {
    row.forEach((person, index) => {
      horizontalRanks.set(person.id, index - (row.length - 1) / 2);
    });
  }
  rows.forEach(updateHorizontalRanks);

  function horizontalRank(personId: string) {
    return horizontalRanks.get(personId) ?? 0;
  }

  function orderByNeighbors(row: Person[], neighborsByPerson: Map<string, string[]>) {
    const currentOrder = new Map(row.map((person, index) => [person.id, index]));
    const barycenter = (person: Person) => {
      const neighbors = neighborsByPerson.get(person.id) ?? [];
      if (neighbors.length === 0) return null;
      return neighbors.reduce((total, neighborId) => total + horizontalRank(neighborId), 0) / neighbors.length;
    };

    row.sort((left, right) => {
      const leftCenter = barycenter(left);
      const rightCenter = barycenter(right);
      if (leftCenter === null && rightCenter === null) {
        return currentOrder.get(left.id)! - currentOrder.get(right.id)!;
      }
      if (leftCenter === null) return 1;
      if (rightCenter === null) return -1;
      return leftCenter - rightCenter || currentOrder.get(left.id)! - currentOrder.get(right.id)!;
    });
    updateHorizontalRanks(row);
  }

  for (let pass = 0; pass < 4; pass += 1) {
    for (let generation = 1; generation <= maxGeneration; generation += 1) {
      orderByNeighbors(rows.get(generation) ?? [], parentsByChild);
    }
    for (let generation = maxGeneration - 1; generation >= 0; generation -= 1) {
      orderByNeighbors(rows.get(generation) ?? [], childrenByParent);
    }
  }

  return people.map((person) => {
    const rowNumber = compactedGenerations.get(person.id) ?? 0;
    const row = rows.get(rowNumber) ?? [];
    const saved = positions[person.id];
    const basePosition = {
      x: (row.indexOf(person) - (row.length - 1) / 2) * 220,
      y: rowNumber * 170 + 50,
    };

    let relatedPosition: SavedPosition | undefined;
    const parentEdges = edges.filter((edge) => edge.target === person.id);
    const childEdges = edges.filter((edge) => edge.source === person.id);

    if (parentEdges.length > 0) {
      const knownParents = parentEdges
        .map((edge) => positions[edge.source])
        .filter((position): position is SavedPosition => position !== undefined);

      if (knownParents.length > 0) {
        relatedPosition = {
          x: knownParents.reduce((total, position) => total + position.x, 0) / knownParents.length,
          y: Math.max(...knownParents.map((position) => position.y)) + 170,
        };
      }
    }

    if (!relatedPosition && childEdges.length > 0) {
      const knownChildren = childEdges
        .map((edge) => ({ edge, position: positions[edge.target] }))
        .filter((item): item is { edge: Edge; position: SavedPosition } => item.position !== undefined);

      if (knownChildren.length > 0) {
        const { edge: childEdge, position: childPosition } = knownChildren[0];
        const otherParentPositions = edges
          .filter((edge) => edge.target === childEdge.target && edge.source !== person.id)
          .map((edge) => positions[edge.source])
          .filter((position): position is SavedPosition => position !== undefined);
        const otherParent = otherParentPositions[0];

        relatedPosition = {
          x: otherParent
            ? childPosition.x + (otherParent.x <= childPosition.x ? 140 : -140)
            : childPosition.x,
          y: childPosition.y - 170,
        };
      }
    }

    const desiredPosition = saved ?? relatedPosition ?? basePosition;
    let position = desiredPosition;
    if (!saved && relatedPosition) {
      const occupied = Object.entries(positions)
        .filter(([id]) => id !== person.id)
        .map(([, existing]) => existing);
      const offsets = [0, -210, 210, -420, 420, -630, 630];
      const freeOffset = offsets.find((offset) =>
        !occupied.some((existing) =>
          Math.abs(existing.y - desiredPosition.y) < 80 &&
          Math.abs(existing.x - (desiredPosition.x + offset)) < 180,
        ),
      );

      if (freeOffset !== undefined) {
        position = { ...desiredPosition, x: desiredPosition.x + freeOffset };
      }
    }

    return {
      id: person.id,
      type: "person",
      position,
      data: {
        person,
        canAddParent: (parentsByChild.get(person.id)?.length ?? 0) < 2,
        onRename,
        onDelete,
        onAddRelated,
      },
    };
  });
}