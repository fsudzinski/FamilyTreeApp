import type { Edge } from "@xyflow/react";
import type { Person } from "../api/persons";
import type {
  FamilyTreeEdge,
  PersonNodeData,
  PersonTreeNode,
  RelationshipPair,
  SiblingJunctionRoute,
} from "../pages/TreeView";

export type SavedPosition = { x: number; y: number };
export type ConnectionStyle = "curved" | "straight";
export const CONNECTION_STYLE_STORAGE_KEY = "family-tree-connection-style";

export const PERSON_NODE_WIDTH = 166;
export const PERSON_NODE_HEIGHT = 98;
const PARTNER_GAP = 30;
const SIBLING_GAP = 30;
const ROW_GAP = 70;
const COMPONENT_GAP = 80;

export function arrangePeople(
  people: Person[],
  edges: Edge[],
  positions: Record<string, SavedPosition>,
  onRename: PersonNodeData["onRename"],
  onDelete: PersonNodeData["onDelete"],
  onAddRelated: PersonNodeData["onAddRelated"],
): PersonTreeNode[] {
  const orderedPeople = [...people].sort((left, right) =>
    `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`) ||
    left.id.localeCompare(right.id),
  );
  const ids = new Set(orderedPeople.map((person) => person.id));
  const order = new Map(orderedPeople.map((person, index) => [person.id, index]));
  const byOrder = (left: string, right: string) =>
    (order.get(left) ?? 0) - (order.get(right) ?? 0);

  const parentsOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue;
    const parents = parentsOf.get(edge.target) ?? [];
    if (!parents.includes(edge.source)) parents.push(edge.source);
    parentsOf.set(edge.target, parents);
  }

  const partners = new Map(orderedPeople.map((person) => [person.id, new Set<string>()]));
  for (const parents of parentsOf.values()) {
    if (parents.length !== 2) continue;
    partners.get(parents[0])?.add(parents[1]);
    partners.get(parents[1])?.add(parents[0]);
  }

  const unitOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  for (const person of orderedPeople) {
    if (unitOf.has(person.id)) continue;

    const group: string[] = [];
    const stack = [person.id];
    unitOf.set(person.id, person.id);
    while (stack.length > 0) {
      const current = stack.pop()!;
      group.push(current);
      const currentPartners = [...(partners.get(current) ?? [])].sort(byOrder).reverse();
      for (const partner of currentPartners) {
        if (unitOf.has(partner)) continue;
        unitOf.set(partner, person.id);
        stack.push(partner);
      }
    }

    const remaining = new Set(group);
    const start = [...group].sort((left, right) =>
      (partners.get(left)?.size ?? 0) - (partners.get(right)?.size ?? 0) || byOrder(left, right),
    )[0];
    const orderedMembers: string[] = [];
    let current: string | undefined = start;
    while (current) {
      orderedMembers.push(current);
      remaining.delete(current);
      current = [...(partners.get(current) ?? [])].filter((id) => remaining.has(id)).sort(byOrder)[0];
    }
    orderedMembers.push(...[...remaining].sort(byOrder));
    members.set(person.id, orderedMembers);
  }

  const unitMin = (unitId: string) => Math.min(...(members.get(unitId) ?? []).map((id) => order.get(id) ?? 0));
  const unitIds = [...members.keys()].sort((left, right) => unitMin(left) - unitMin(right));
  const parentUnits = new Map<string, string[]>();
  const childUnits = new Map(unitIds.map((unitId) => [unitId, [] as string[]]));

  for (const unitId of unitIds) {
    const parentSet = new Set<string>();
    for (const member of members.get(unitId) ?? []) {
      for (const parent of parentsOf.get(member) ?? []) {
        const parentUnit = unitOf.get(parent);
        if (parentUnit && parentUnit !== unitId) parentSet.add(parentUnit);
      }
    }
    const sortedParents = [...parentSet].sort((left, right) => unitMin(left) - unitMin(right));
    parentUnits.set(unitId, sortedParents);
    for (const parentUnit of sortedParents) {
      childUnits.get(parentUnit)?.push(unitId);
    }
  }

  const generations = new Map<string, number>();
  const visiting = new Set<string>();
  function generationOf(unitId: string): number {
    const known = generations.get(unitId);
    if (known !== undefined) return known;
    if (visiting.has(unitId)) return 0;

    visiting.add(unitId);
    let generation = 0;
    for (const parentUnit of parentUnits.get(unitId) ?? []) {
      generation = Math.max(generation, generationOf(parentUnit) + 1);
    }
    visiting.delete(unitId);
    generations.set(unitId, generation);
    return generation;
  }
  unitIds.forEach(generationOf);

  const compactedGenerations = new Map(generations);
  const deepestFirst = [...unitIds].sort((left, right) =>
    (generations.get(right) ?? 0) - (generations.get(left) ?? 0),
  );
  for (const unitId of deepestFirst) {
    const children = childUnits.get(unitId) ?? [];
    if (children.length === 0) continue;
    const lowestChildGeneration = Math.min(...children.map((child) => compactedGenerations.get(child) ?? 0));
    compactedGenerations.set(unitId, Math.max(
      generations.get(unitId) ?? 0,
      lowestChildGeneration - 1,
    ));
  }

  const layoutChildren = new Map(unitIds.map((unitId) => [unitId, [] as string[]]));
  for (const unitId of unitIds) {
    const parents = parentUnits.get(unitId) ?? [];
    if (parents.length === 0) continue;
    const primaryParent = [...parents].sort((left, right) =>
      (compactedGenerations.get(right) ?? 0) - (compactedGenerations.get(left) ?? 0) ||
      unitMin(left) - unitMin(right),
    )[0];
    layoutChildren.get(primaryParent)?.push(unitId);
  }

  const unitWidth = (unitId: string) => {
    const count = members.get(unitId)?.length ?? 1;
    return count * PERSON_NODE_WIDTH + (count - 1) * PARTNER_GAP;
  };
  const subtreeWidths = new Map<string, number>();
  const measuring = new Set<string>();
  function measure(unitId: string): number {
    const cached = subtreeWidths.get(unitId);
    if (cached !== undefined) return cached;
    if (measuring.has(unitId)) return unitWidth(unitId);

    measuring.add(unitId);
    const children = layoutChildren.get(unitId) ?? [];
    const childrenWidth = children.reduce((total, child) => total + measure(child), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    measuring.delete(unitId);
    const width = Math.max(unitWidth(unitId), childrenWidth);
    subtreeWidths.set(unitId, width);
    return width;
  }

  const computed = new Map<string, SavedPosition>();
  const placed = new Set<string>();
  function place(unitId: string, left: number) {
    if (placed.has(unitId)) return;
    placed.add(unitId);

    const width = measure(unitId);
    const generation = compactedGenerations.get(unitId) ?? 0;
    const y = generation * (PERSON_NODE_HEIGHT + ROW_GAP);
    let x = left + (width - unitWidth(unitId)) / 2;
    for (const member of members.get(unitId) ?? []) {
      computed.set(member, { x, y });
      x += PERSON_NODE_WIDTH + PARTNER_GAP;
    }

    const children = (layoutChildren.get(unitId) ?? []).filter((child) => !placed.has(child));
    const childrenWidth = children.reduce((total, child) => total + measure(child), 0) +
      Math.max(0, children.length - 1) * SIBLING_GAP;
    let childX = left + (width - childrenWidth) / 2;
    for (const child of children) {
      place(child, childX);
      childX += measure(child) + SIBLING_GAP;
    }
  }

  let cursor = 0;
  const roots = unitIds.filter((unitId) => (parentUnits.get(unitId)?.length ?? 0) === 0);
  for (const root of roots) {
    place(root, cursor);
    cursor += measure(root) + COMPONENT_GAP;
  }
  for (const unitId of unitIds) {
    if (placed.has(unitId)) continue;
    place(unitId, cursor);
    cursor += measure(unitId) + COMPONENT_GAP;
  }

  if (computed.size > 0) {
    const minX = Math.min(...[...computed.values()].map((position) => position.x));
    const maxX = Math.max(...[...computed.values()].map((position) => position.x + PERSON_NODE_WIDTH));
    const centerX = (minX + maxX) / 2;
    for (const [personId, position] of computed) {
      computed.set(personId, { ...position, x: position.x - centerX });
    }
  }

  return people.map((person) => ({
    id: person.id,
    type: "person",
    position: positions[person.id] ?? computed.get(person.id) ?? { x: 0, y: 0 },
    data: {
      person,
      canAddParent: (parentsOf.get(person.id)?.length ?? 0) < 2,
      onRename,
      onDelete,
      onAddRelated,
    },
  }));
}

export function routeSiblingConnections(
  people: Person[],
  edges: FamilyTreeEdge[],
): FamilyTreeEdge[] {
  const peopleOrder = new Map(people.map((person, index) => [person.id, index]));
  const parentsOf = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentsOf.get(edge.target) ?? [];
    if (!parents.includes(edge.source)) parents.push(edge.source);
    parentsOf.set(edge.target, parents);
  }

  const childrenByParents = new Map<string, string[]>();
  for (const [childId, parents] of parentsOf) {
    const orderedParents = [...parents].sort((left, right) =>
      (peopleOrder.get(left) ?? 0) - (peopleOrder.get(right) ?? 0),
    );
    const groupKey = orderedParents.join(":");
    const children = childrenByParents.get(groupKey) ?? [];
    children.push(childId);
    childrenByParents.set(groupKey, children);
  }

  const routeByRelationship = new Map<string, {
    route: SiblingJunctionRoute;
    relationships: RelationshipPair[];
  }>();
  for (const [groupKey, children] of childrenByParents) {
    if (children.length < 2) continue;

    const parentIds = groupKey.split(":");
    const childIds = [...children].sort((left, right) =>
      (peopleOrder.get(left) ?? 0) - (peopleOrder.get(right) ?? 0),
    );
    const firstParentId = parentIds[0];
    const firstChildId = childIds[0];

    for (const parentId of parentIds) {
      for (const childId of childIds) {
        const showParentSegment = childId === firstChildId;
        const showChildSegment = parentId === firstParentId;
        const relationships: RelationshipPair[] = [];
        if (showParentSegment) {
          relationships.push(...childIds.map((groupChildId) => ({ parentId, childId: groupChildId })));
        }
        if (showChildSegment) {
          relationships.push(...parentIds.map((groupParentId) => ({ parentId: groupParentId, childId })));
        }

        const uniqueRelationships = [...new Map(relationships.map((relationship) =>
          [`${relationship.parentId}:${relationship.childId}`, relationship],
        )).values()];
        routeByRelationship.set(`${parentId}:${childId}`, {
          route: {
            parentIds,
            childIds,
            showParentSegment,
            showChildSegment,
          },
          relationships: uniqueRelationships,
        });
      }
    }
  }

  return edges.map((edge) => {
    const edgeData = edge.data ?? { onRemove: () => {} };
    const routed = routeByRelationship.get(`${edge.source}:${edge.target}`);
    if (!routed) {
      return {
        ...edge,
        hidden: false,
        data: { ...edgeData, junctionRoute: undefined, relationships: undefined },
      };
    }

    return {
      ...edge,
      hidden: !routed.route.showParentSegment && !routed.route.showChildSegment,
      data: {
        ...edgeData,
        junctionRoute: routed.route,
        relationships: routed.relationships,
      },
    };
  });
}

export function applyConnectionStyle(
  people: Person[],
  edges: FamilyTreeEdge[],
  style: ConnectionStyle,
): FamilyTreeEdge[] {
  const ungroupedEdges = edges.map((edge) => ({
    ...edge,
    hidden: false,
    data: {
      ...(edge.data ?? { onRemove: () => {} }),
      connectionStyle: style,
      junctionRoute: undefined,
      relationships: undefined,
    },
  }));
  return style === "straight" ? routeSiblingConnections(people, ungroupedEdges) : ungroupedEdges;
}