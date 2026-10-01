import axios from "axios";
import {
  addEdge,
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  createFamilyTree,
  deleteFamilyTree,
  getFamilyTrees,
  type FamilyTree,
  updateFamilyTree,
} from "../api/familyTrees";
import {
  createPerson,
  deletePerson,
  getPeopleInTree,
  getPersonChildren,
  type Person,
  updatePerson,
} from "../api/persons";
import { createRelationship, deleteRelationship } from "../api/relationships";
import { useAuth } from "../auth/AuthContext";

type NameField = "firstName" | "lastName";
type YearField = "birthYear" | "deathYear";
type PersonField = NameField | YearField;
type RelationshipSide = "parent" | "child";
type PersonNodeData = {
  person: Person;
  canAddParent: boolean;
  onRename: (person: Person, field: PersonField, value: string) => Promise<void>;
  onDelete: (person: Person) => Promise<void>;
  onAddRelated: (
    person: Person,
    side: RelationshipSide,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
};
type PersonTreeNode = Node<PersonNodeData, "person">;
type ConnectionEdgeData = {
  onRemove: (edgeId: string, parentId: string, childId: string) => void;
};
type FamilyTreeEdge = Edge<ConnectionEdgeData, "connection">;
type SavedPosition = { x: number; y: number };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body: unknown = error.response?.data;
    if (typeof body === "string") return body;
    if (Array.isArray(body)) return body.join(" ");
    if (body && typeof body === "object" && "message" in body) {
      return String(body.message);
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function ConnectionEdgeView({
  id,
  source,
  target,
  selected,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  style,
}: EdgeProps<FamilyTreeEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
      />
      <EdgeLabelRenderer>
        {selected && (
          <button
            className="connection-delete-button nodrag nopan"
            type="button"
            aria-label="Remove connection"
            title="Remove connection"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(event) => {
              event.stopPropagation();
              data?.onRemove(id, source, target);
            }}
          >
            <span className="connection-delete-icon" aria-hidden="true" />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { connection: ConnectionEdgeView };

function PersonNodeView({ data, selected }: NodeProps<PersonTreeNode>) {
  const [editingField, setEditingField] = useState<PersonField | null>(null);
  const [draft, setDraft] = useState("");
  const [addingSide, setAddingSide] = useState<RelationshipSide | null>(null);
  const [relatedFirstName, setRelatedFirstName] = useState("");
  const [relatedLastName, setRelatedLastName] = useState("");
  const [adding, setAdding] = useState(false);
  const savingRef = useRef(false);

  function startEditing(field: PersonField) {
    setDraft(String(data.person[field] ?? ""));
    setEditingField(field);
  }

  async function commitEdit() {
    if (!editingField || savingRef.current) return;
    const field = editingField;
    const value = draft.trim();
    const isYearField = field === "birthYear" || field === "deathYear";
    if (!value && !isYearField) {
      setEditingField(null);
      return;
    }
    if (isYearField && value && (!/^\d{1,4}$/.test(value) || Number(value) < 1)) return;

    savingRef.current = true;
    try {
      await data.onRename(data.person, field, value);
      setEditingField(null);
    } catch {
      // The page displays the API error and keeps the field open for correction.
    } finally {
      savingRef.current = false;
    }
  }

  function renderName(field: NameField) {
    if (editingField === field) {
      return (
        <input
          className="person-inline-input nodrag"
          aria-label={`Edit ${field === "firstName" ? "first" : "last"} name`}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitEdit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitEdit();
            }
            if (event.key === "Escape") setEditingField(null);
          }}
        />
      );
    }

    return (
      <button
        className={`person-name-part nodrag${field === "lastName" ? " person-last-name" : ""}`}
        type="button"
        title="Double-click or press Enter to edit"
        onDoubleClick={(event) => {
          event.stopPropagation();
          startEditing(field);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
            startEditing(field);
          }
        }}
      >
        {data.person[field]}
      </button>
    );
  }

  function renderYear(field: YearField) {
    if (editingField === field) {
      return (
        <input
          className="person-inline-input person-year-input nodrag"
          type="number"
          min={1}
          max={9999}
          step={1}
          aria-label={`Edit ${field === "birthYear" ? "birth" : "death"} year`}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitEdit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commitEdit();
            }
            if (event.key === "Escape") setEditingField(null);
          }}
        />
      );
    }

    const year = data.person[field];
    return (
      <button
        className="person-year-button nodrag"
        type="button"
        aria-label={`${field === "birthYear" ? "Birth" : "Death"} year: ${year ?? "not set"}`}
        title={`Double-click to edit ${field === "birthYear" ? "birth" : "death"} year`}
        onDoubleClick={(event) => {
          event.stopPropagation();
          startEditing(field);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
            startEditing(field);
          }
        }}
      >
        {year ?? (field === "birthYear" ? "Born" : "Died")}
      </button>
    );
  }

  async function submitRelatedPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addingSide || adding) return;

    setAdding(true);
    try {
      await data.onAddRelated(
        data.person,
        addingSide,
        relatedFirstName.trim(),
        relatedLastName.trim(),
      );
      setAddingSide(null);
      setRelatedFirstName("");
      setRelatedLastName("");
    } catch {
      // The page displays the API error; keep the form open for retry.
    } finally {
      setAdding(false);
    }
  }

  function openRelatedForm(side: RelationshipSide, event: React.MouseEvent) {
    event.stopPropagation();
    setAddingSide(side);
    setRelatedFirstName("");
    setRelatedLastName("");
  }

  return (
    <div className="person-node">
      <Handle type="target" position={Position.Top} />
      {data.canAddParent && (
        <button
          className="person-add-button person-add-parent nodrag nopan"
          type="button"
          aria-label={`Add a parent of ${data.person.firstName} ${data.person.lastName}`}
          title="Add parent"
          onClick={(event) => openRelatedForm("parent", event)}
        >
          +
        </button>
      )}
      {selected && (
        <button
          className="person-delete-button nodrag"
          type="button"
          aria-label={`Delete ${data.person.firstName} ${data.person.lastName}`}
          title="Delete this person"
          onClick={(event) => {
            event.stopPropagation();
            const fullName = `${data.person.firstName} ${data.person.lastName}`;
            if (window.confirm(`Delete ${fullName} and their parent-child links?`)) {
              void data.onDelete(data.person);
            }
          }}
        >
          ×
        </button>
      )}
      {renderName("firstName")}
      {renderName("lastName")}
      <div className="person-year-fields">
        {renderYear("birthYear")}
        <span aria-hidden="true">–</span>
        {renderYear("deathYear")}
      </div>
      <button
        className="person-add-button person-add-child nodrag nopan"
        type="button"
        aria-label={`Add a child of ${data.person.firstName} ${data.person.lastName}`}
        title="Add child"
        onClick={(event) => openRelatedForm("child", event)}
      >
        +
      </button>
      {addingSide && (
        <form
          className={`related-person-form nodrag nopan related-person-form-${addingSide}`}
          onSubmit={(event) => void submitRelatedPerson(event)}
          onClick={(event) => event.stopPropagation()}
        >
          <strong>Add {addingSide}</strong>
          <input
            aria-label="First name"
            placeholder="First name"
            autoFocus
            value={relatedFirstName}
            onChange={(event) => setRelatedFirstName(event.target.value)}
            maxLength={100}
            required
          />
          <input
            aria-label="Last name"
            placeholder="Last name"
            value={relatedLastName}
            onChange={(event) => setRelatedLastName(event.target.value)}
            maxLength={100}
            required
          />
          <div className="related-person-actions">
            <button type="button" onClick={() => setAddingSide(null)}>Cancel</button>
            <button type="submit" disabled={adding}>
              {adding ? "Adding..." : "Add person"}
            </button>
          </div>
        </form>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { person: PersonNodeView };

function savedPositions(treeId: string): Record<string, SavedPosition> {
  try {
    const stored = localStorage.getItem(`family-tree-layout:${treeId}`);
    return stored ? (JSON.parse(stored) as Record<string, SavedPosition>) : {};
  } catch {
    return {};
  }
}

function arrangePeople(
  people: Person[],
  edges: Edge[],
  positions: Record<string, SavedPosition>,
  onRename: PersonNodeData["onRename"],
  onDelete: PersonNodeData["onDelete"],
  onAddRelated: PersonNodeData["onAddRelated"],
): PersonTreeNode[] {
  const parentsByChild = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentsByChild.get(edge.target) ?? [];
    parents.push(edge.source);
    parentsByChild.set(edge.target, parents);
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

  const rows = new Map<number, Person[]>();
  for (const person of people) {
    const rowNumber = generationOf(person.id);
    const row = rows.get(rowNumber) ?? [];
    row.push(person);
    rows.set(rowNumber, row);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }

  return people.map((person) => {
    const rowNumber = generations.get(person.id) ?? 0;
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

export default function TreeView() {
  const { status, refreshUser } = useAuth();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [treeName, setTreeName] = useState("");
  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [editedTreeName, setEditedTreeName] = useState("");
  const [treeActionId, setTreeActionId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [treesLoading, setTreesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [readyTreeId, setReadyTreeId] = useState<string | null>(null);
  const [loadedTreeId, setLoadedTreeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<PersonTreeNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FamilyTreeEdge>([]);

  const handleRename = useCallback(async (person: Person, field: PersonField, value: string) => {
    const updatedPerson: Person = field === "birthYear"
      ? { ...person, birthYear: value ? Number(value) : null }
      : field === "deathYear"
        ? { ...person, deathYear: value ? Number(value) : null }
        : { ...person, [field]: value };
    try {
      await updatePerson(person.id, {
        firstName: updatedPerson.firstName,
        lastName: updatedPerson.lastName,
        birthYear: updatedPerson.birthYear,
        deathYear: updatedPerson.deathYear,
      });
      setNodes((currentNodes) => currentNodes.map((node) =>
        node.id === person.id
          ? { ...node, data: { ...node.data, person: updatedPerson } }
          : node,
      ));
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
      throw requestError;
    }
  }, [setNodes]);

  const handleDelete = useCallback(async (person: Person) => {
    try {
      await deletePerson(person.id);
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== person.id));
      setEdges((currentEdges) => currentEdges.filter(
        (edge) => edge.source !== person.id && edge.target !== person.id,
      ));
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [setEdges, setNodes]);

  const handleRemoveConnection = useCallback(async (
    edgeId: string,
    parentId: string,
    childId: string,
  ) => {
    setError(null);
    try {
      await deleteRelationship(parentId, childId);
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [setEdges]);

  const handleAddRelated = useCallback(async (
    person: Person,
    side: RelationshipSide,
    relatedFirstName: string,
    relatedLastName: string,
  ) => {
    const treeId = person.familyTreeId ?? selectedTreeId;
    if (!treeId) throw new Error("Select a family tree first.");

    try {
      const relatedPerson = await createPerson({
        firstName: relatedFirstName,
        lastName: relatedLastName,
        familyTreeId: treeId,
      });

      try {
        await createRelationship(side === "parent"
          ? { parentId: relatedPerson.id, childId: person.id }
          : { parentId: person.id, childId: relatedPerson.id });
      } catch (relationshipError) {
        await deletePerson(relatedPerson.id);
        throw relationshipError;
      }

      setReadyTreeId(null);
      setLoadedTreeId(null);
      setError(null);
      setReloadCount((count) => count + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
      throw requestError;
    }
  }, [selectedTreeId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    getFamilyTrees()
      .then((result) => {
        if (!active) return;
        setTrees(result);
        setSelectedTreeId((current) =>
          current && result.some((tree) => tree.id === current)
            ? current
            : result[0]?.id ?? null,
        );
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setTreesLoading(false);
      });
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !selectedTreeId) return;

    let active = true;
    const treeId = selectedTreeId;

    async function loadTree() {
      try {
        const people = await getPeopleInTree(treeId);
        const children = await Promise.all(people.map((person) => getPersonChildren(person.id)));
        if (!active) return;

        const pairs = new Set<string>();
        people.forEach((parent, index) => {
          children[index].forEach((child) => pairs.add(`${parent.id}:${child.id}`));
        });
        const treeEdges: FamilyTreeEdge[] = Array.from(pairs, (pair) => {
          const [source, target] = pair.split(":");
          return {
            id: `${source}-${target}`,
            source,
            target,
            type: "connection",
            deletable: false,
            data: { onRemove: handleRemoveConnection },
          };
        });

        setEdges(treeEdges);
        setNodes(arrangePeople(
          people,
          treeEdges,
          savedPositions(treeId),
          handleRename,
          handleDelete,
          handleAddRelated,
        ));
        setReadyTreeId(treeId);
      } catch (requestError) {
        if (active) setError(errorMessage(requestError));
      } finally {
        if (active) setLoadedTreeId(treeId);
      }
    }

    void loadTree();
    return () => { active = false; };
  }, [status, selectedTreeId, reloadCount, setEdges, setNodes, handleRename, handleDelete, handleAddRelated, handleRemoveConnection]);

  useEffect(() => {
    if (!selectedTreeId || readyTreeId !== selectedTreeId) return;
    const positions = Object.fromEntries(nodes.map((node) => [node.id, node.position]));
    localStorage.setItem(`family-tree-layout:${selectedTreeId}`, JSON.stringify(positions));
  }, [nodes, selectedTreeId, readyTreeId]);

  async function handleCreateTree(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = treeName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const tree = await createFamilyTree(name);
      setTrees((current) => [...current, tree]);
      setNodes([]);
      setEdges([]);
      setReadyTreeId(null);
      setLoadedTreeId(null);
      setError(null);
      setSelectedTreeId(tree.id);
      setTreeName("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameTree(event: FormEvent<HTMLFormElement>, tree: FamilyTree) {
    event.preventDefault();
    const name = editedTreeName.trim();
    if (!name) return;

    setTreeActionId(tree.id);
    setError(null);
    try {
      await updateFamilyTree(tree.id, name);
      setTrees((current) => current.map((item) =>
        item.id === tree.id ? { ...item, name } : item,
      ));
      setEditingTreeId(null);
      setEditedTreeName("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setTreeActionId(null);
    }
  }

  async function handleDeleteTree(tree: FamilyTree) {
    if (!window.confirm(`Delete "${tree.name}" and all its people and relationships? This cannot be undone.`)) {
      return;
    }

    setTreeActionId(tree.id);
    setError(null);
    try {
      await deleteFamilyTree(tree.id);
      localStorage.removeItem(`family-tree-layout:${tree.id}`);
      const remainingTrees = trees.filter((item) => item.id !== tree.id);
      setTrees(remainingTrees);
      setEditingTreeId(null);
      if (selectedTreeId === tree.id) {
        setNodes([]);
        setEdges([]);
        setReadyTreeId(null);
        setLoadedTreeId(null);
        setSelectedTreeId(remainingTrees[0]?.id ?? null);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setTreeActionId(null);
    }
  }

  async function handleCreatePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTreeId) return;
    setSaving(true);
    setError(null);
    try {
      await createPerson({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        familyTreeId: selectedTreeId,
        birthYear: birthYear ? Number(birthYear) : null,
        deathYear: deathYear ? Number(deathYear) : null,
      });
      setFirstName("");
      setLastName("");
      setBirthYear("");
      setDeathYear("");
      setReadyTreeId(null);
      setLoadedTreeId(null);
      setReloadCount((count) => count + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    setError(null);
    try {
      await createRelationship({ parentId: connection.source, childId: connection.target });
      setEdges((current) => addEdge({
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: "connection",
        deletable: false,
        data: { onRemove: handleRemoveConnection },
      }, current));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  function handleResetLayout() {
    if (!selectedTreeId || nodes.length === 0) return;
    localStorage.removeItem(`family-tree-layout:${selectedTreeId}`);
    setNodes(arrangePeople(
      nodes.map((node) => node.data.person),
      edges,
      {},
      handleRename,
      handleDelete,
      handleAddRelated,
    ));
  }

  if (status === "loading") return <main className="status-page"><p>Checking your session...</p></main>;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "error") {
    return (
      <main className="status-page">
        <p className="form-error" role="alert">Could not verify your session.</p>
        <button className="primary-button" type="button" onClick={() => void refreshUser()}>Try again</button>
      </main>
    );
  }

  const selectedTree = trees.find((tree) => tree.id === selectedTreeId);
  const canvasLoading = Boolean(selectedTreeId && loadedTreeId !== selectedTreeId);

  return (
    <main className="tree-workspace">
      <aside className="tree-sidebar">
        <header className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">F</span>
          <div>
            <p className="eyebrow">Family archive</p>
            <h1>Roots &amp; Branches</h1>
          </div>
        </header>

        <section className="sidebar-section tree-list-section" aria-labelledby="sidebar-trees-heading">
          <div className="sidebar-section-heading">
            <h2 id="sidebar-trees-heading">Your trees</h2>
            <span className="tree-count">{trees.length}</span>
          </div>
          {treesLoading ? <p className="sidebar-hint">Loading trees...</p> : trees.length === 0 ? (
            <p className="sidebar-hint">Create a family tree to begin.</p>
          ) : (
            <ul className="sidebar-tree-list">
              {trees.map((tree) => (
                <li className="sidebar-tree-item" key={tree.id}>
                  {editingTreeId === tree.id ? (
                    <form className="sidebar-tree-edit-form" onSubmit={(event) => void handleRenameTree(event, tree)}>
                      <input
                        aria-label="Family tree name"
                        value={editedTreeName}
                        onChange={(event) => setEditedTreeName(event.target.value)}
                        maxLength={100}
                        autoFocus
                        required
                      />
                      <div className="sidebar-tree-edit-actions">
                        <button type="submit" disabled={treeActionId === tree.id || !editedTreeName.trim()}>
                          {treeActionId === tree.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={treeActionId === tree.id}
                          onClick={() => {
                            setEditingTreeId(null);
                            setEditedTreeName("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        className="sidebar-tree-button"
                        type="button"
                        aria-current={selectedTreeId === tree.id ? "true" : undefined}
                        onClick={() => {
                          setNodes([]);
                          setEdges([]);
                          setReadyTreeId(null);
                          setLoadedTreeId(null);
                          setError(null);
                          setSelectedTreeId(tree.id);
                        }}
                      >
                        <span className="tree-bullet" aria-hidden="true" />
                        <span>{tree.name}</span>
                      </button>
                      <div className="sidebar-tree-actions">
                        <button
                          className="sidebar-tree-action"
                          type="button"
                          aria-label={`Rename ${tree.name}`}
                          title="Rename tree"
                          disabled={treeActionId !== null}
                          onClick={() => {
                            setEditingTreeId(tree.id);
                            setEditedTreeName(tree.name);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="sidebar-tree-action sidebar-tree-delete"
                          type="button"
                          aria-label={`Delete ${tree.name}`}
                          title="Delete tree"
                          disabled={treeActionId !== null}
                          onClick={() => void handleDeleteTree(tree)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="sidebar-form" onSubmit={handleCreateTree}>
            <label htmlFor="new-tree-name">Create a tree</label>
            <input
              id="new-tree-name"
              value={treeName}
              onChange={(event) => setTreeName(event.target.value)}
              maxLength={100}
              placeholder="e.g. The Morgan family"
              required
            />
            <button className="sidebar-add-button" type="submit" disabled={saving || !treeName.trim()}>
              {saving ? "Creating..." : "+ New family tree"}
            </button>
          </form>
        </section>

        {selectedTree && (
          <section className="sidebar-section add-person-section" aria-labelledby="add-person-heading">
            <h2 id="add-person-heading">Add a person</h2>
            <form className="sidebar-form" onSubmit={handleCreatePerson}>
              <label htmlFor="person-first-name">First name</label>
              <input id="person-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required />
              <label htmlFor="person-last-name">Last name</label>
              <input id="person-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required />
              <label htmlFor="person-birth-year">Birth year</label>
              <input id="person-birth-year" type="number" min={1} max={9999} step={1} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} />
              <label htmlFor="person-death-year">Death year</label>
              <input id="person-death-year" type="number" min={1} max={9999} step={1} value={deathYear} onChange={(event) => setDeathYear(event.target.value)} />
              <button className="sidebar-add-button" type="submit" disabled={saving}>
                {saving ? "Adding..." : "+ Add person"}
              </button>
            </form>
          </section>
        )}

        <p className="sidebar-footnote">Hover a person and use + above or below to add a connected parent or child. Select a connection to remove it. Drag nodes to arrange your tree.</p>
      </aside>

      <section className="tree-canvas-panel" aria-label="Family tree canvas">
        <header className="canvas-header">
          <div>
            <p className="eyebrow">Family tree view</p>
            <h2>{selectedTree?.name ?? "Choose a family tree"}</h2>
          </div>
          {selectedTree && (
            <div className="canvas-header-actions">
              <span className="canvas-person-count">{nodes.length} people</span>
              <button
                className="layout-reset-button"
                type="button"
                onClick={handleResetLayout}
                disabled={canvasLoading || nodes.length === 0}
              >
                Reset layout
              </button>
            </div>
          )}
        </header>
        {error && <p className="form-error canvas-error" role="alert">{error}</p>}
        <div className="tree-canvas">
          {!selectedTree ? (
            <div className="canvas-empty">
              <span className="empty-tree-icon" aria-hidden="true">✳</span>
              <h3>Your family story starts here</h3>
              <p>Create a tree from the sidebar, then add its first person.</p>
            </div>
          ) : canvasLoading ? (
            <div className="canvas-empty"><p>Growing your tree...</p></div>
          ) : nodes.length === 0 ? (
            <div className="canvas-empty">
              <span className="empty-tree-icon" aria-hidden="true">✳</span>
              <h3>A new branch begins</h3>
              <p>Add a person from the sidebar to start this tree.</p>
            </div>
          ) : (
            <ReactFlow<PersonTreeNode, FamilyTreeEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(connection) => void handleConnect(connection)}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#bdc9b8" gap={28} size={1} />
              <Controls position="bottom-right" />
            </ReactFlow>
          )}
        </div>
      </section>
    </main>
  );
}