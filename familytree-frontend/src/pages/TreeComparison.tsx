import axios from "axios";
import {
  addEdge,
  Background,
  Controls,
  Panel,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getFamilyTrees, type FamilyTree } from "../api/familyTrees";
import { getPeopleInTree, getPersonChildren, type Person } from "../api/persons";
import { getMatchCandidates, type MatchCandidate } from "../api/treeComparison";
import { useAuth } from "../auth/AuthContext";
import {
  ConnectionEdgeView,
  PersonNodeView,
  type ConnectionEdgeData,
  type FamilyTreeEdge,
  type PersonField,
  type PersonNodeData,
  type PersonTreeNode,
  type RelationshipSide,
} from "./TreeView";
import { arrangePeople } from "../utils/treeLayout";
import "./TreeComparison.css";

type TreeSide = "a" | "b";
type ReviewMode = "bulk" | "manual";
type CandidateDecision = {
  accepted: boolean | null;
  birthYearSide: TreeSide | null;
  deathYearSide: TreeSide | null;
};
type PreviewOrigin = TreeSide | "merged";
type PreviewGraph = { nodes: PersonTreeNode[]; edges: FamilyTreeEdge[] };
type TreeGraph = { persons: Person[]; edges: { source: string; target: string }[] };
type PreviewActions = Pick<PersonNodeData, "onRename" | "onDelete" | "onAddRelated"> & {
  onRemove: ConnectionEdgeData["onRemove"];
};

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body: unknown = error.response?.data;
    if (typeof body === "string") return body;
    if (body && typeof body === "object" && "message" in body) {
      return String(body.message);
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function candidateKey(candidate: MatchCandidate) {
  return `${candidate.personA.id}:${candidate.personB.id}`;
}

function yearText(year: number | null | undefined) {
  return year ?? "Unknown";
}

const previewNodeTypes = { person: PersonNodeView };
const previewEdgeTypes = { connection: ConnectionEdgeView };

async function loadTreeGraph(treeId: string): Promise<TreeGraph> {
  const persons = await getPeopleInTree(treeId);
  const children = await Promise.all(persons.map((person) => getPersonChildren(person.id)));
  const edges = persons.flatMap((person, index) =>
    children[index].map((child) => ({ source: person.id, target: child.id })),
  );
  return { persons, edges };
}

function buildPreview(
  graphA: TreeGraph,
  graphB: TreeGraph,
  candidates: MatchCandidate[],
  decisions: Record<string, CandidateDecision>,
  actions: PreviewActions,
): PreviewGraph {
  const accepted = candidates.filter((candidate) =>
    decisions[candidateKey(candidate)]?.accepted === true,
  );
  const acceptedByA = new Map(accepted.map((candidate) => [candidate.personA.id, candidate]));
  const mergedBToA = new Map(accepted.map((candidate) => [candidate.personB.id, candidate.personA.id]));

  const originById = new Map<string, PreviewOrigin>();
  const people: Person[] = graphA.persons.map((person) => {
    const match = acceptedByA.get(person.id);
    const decision = match ? decisions[candidateKey(match)] : null;
    const mergedPerson = match && decision
      ? {
          ...match.personA,
          birthYear: decision.birthYearSide === "b" ? match.personB.birthYear : match.personA.birthYear,
          deathYear: decision.deathYearSide === "b" ? match.personB.deathYear : match.personA.deathYear,
        }
      : person;
    originById.set(person.id, match ? "merged" : "a");
    return mergedPerson;
  });

  graphB.persons.forEach((person) => {
    if (mergedBToA.has(person.id)) return;
    originById.set(person.id, "b");
    people.push(person);
  });

  const edgeMap = new Map<string, PreviewOrigin>();
  const addEdges = (edges: TreeGraph["edges"], side: TreeSide) => {
    edges.forEach(({ source, target }) => {
      const mappedSource = side === "b" ? mergedBToA.get(source) ?? source : source;
      const mappedTarget = side === "b" ? mergedBToA.get(target) ?? target : target;
      if (mappedSource === mappedTarget) return;
      const key = `${mappedSource}:${mappedTarget}`;
      const origin = edgeMap.get(key);
      edgeMap.set(key, origin && origin !== side ? "merged" : side);
    });
  };
  addEdges(graphA.edges, "a");
  addEdges(graphB.edges, "b");

  const edgeColor: Record<PreviewOrigin, string> = {
    a: "#367b83",
    b: "#b36b28",
    merged: "#39714c",
  };
  const edges: FamilyTreeEdge[] = [...edgeMap].map(([key, origin]) => {
    const [source, target] = key.split(":");
    return {
      id: `${source}-${target}`,
      source,
      target,
      type: "connection",
      deletable: false,
      data: { origin, onRemove: actions.onRemove },
      style: { stroke: edgeColor[origin], strokeWidth: 1.8 },
    };
  });
  const nodes = arrangePeople(people, edges, {}, actions.onRename, actions.onDelete, actions.onAddRelated)
    .map((node) => ({
      ...node,
      data: { ...node.data, origin: originById.get(node.id) },
    }));

  return { nodes, edges };
}

export default function TreeComparison() {
  const { status, refreshUser } = useAuth();
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [treeAId, setTreeAId] = useState("");
  const [treeBId, setTreeBId] = useState("");
  const [treesLoading, setTreesLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, CandidateDecision>>({});
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);
  const [preferredSide, setPreferredSide] = useState<TreeSide>("a");
  const [previewNodes, setPreviewNodes, onPreviewNodesChange] = useNodesState<PersonTreeNode>([]);
  const [previewEdges, setPreviewEdges, onPreviewEdgesChange] = useEdgesState<FamilyTreeEdge>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const previewNodesRef = useRef(previewNodes);
  const handlePreviewAddRelatedRef = useRef<PersonNodeData["onAddRelated"]>(async () => {});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previewNodesRef.current = previewNodes;
  }, [previewNodes]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    getFamilyTrees()
      .then((result) => {
        if (!active) return;
        setTrees(result);
        setTreeAId((current) => current && result.some((tree) => tree.id === current)
          ? current
          : result[0]?.id ?? "");
        setTreeBId((current) => current && result.some((tree) => tree.id === current)
          ? current
          : result[1]?.id ?? "");
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setTreesLoading(false);
      });
    return () => { active = false; };
  }, [status]);

  const treeA = trees.find((tree) => tree.id === treeAId);
  const treeB = trees.find((tree) => tree.id === treeBId);

  const handlePreviewRemove = useCallback((edgeId: string) => {
    setPreviewEdges((current) => current.filter((edge) => edge.id !== edgeId));
  }, [setPreviewEdges]);

  const handlePreviewRename = useCallback(async (person: Person, field: PersonField, value: string) => {
    const updatedPerson: Person = field === "birthYear"
      ? { ...person, birthYear: value ? Number(value) : null }
      : field === "deathYear"
        ? { ...person, deathYear: value ? Number(value) : null }
        : { ...person, [field]: value };
    setPreviewNodes((current) => current.map((node) =>
      node.id === person.id
        ? { ...node, data: { ...node.data, person: updatedPerson } }
        : node,
    ));
  }, [setPreviewNodes]);

  const handlePreviewDelete = useCallback(async (person: Person) => {
    setPreviewNodes((current) => current.filter((node) => node.id !== person.id));
    setPreviewEdges((current) => current.filter((edge) =>
      edge.source !== person.id && edge.target !== person.id,
    ));
  }, [setPreviewEdges, setPreviewNodes]);

  const handlePreviewAddRelated = useCallback(async (
    person: Person,
    side: RelationshipSide,
    firstName: string,
    lastName: string,
  ) => {
    const familyTreeId = person.familyTreeId ?? treeAId;
    if (!familyTreeId) throw new Error("Choose a tree first.");

    const id = crypto.randomUUID();
    const relatedPerson: Person = {
      id,
      firstName,
      lastName,
      birthYear: null,
      deathYear: null,
      familyTreeId,
    };
    const relatedNode = previewNodesRef.current.find((node) => node.id === person.id);
    const offset = side === "parent" ? -170 : 170;
    const position = {
      x: relatedNode?.position.x ?? 0,
      y: (relatedNode?.position.y ?? 40) + offset,
    };
    const source = side === "parent" ? id : person.id;
    const target = side === "parent" ? person.id : id;
    const connectionId = `${source}-${target}`;

    setPreviewNodes((current) => [...current, {
      id,
      type: "person",
      position,
      data: {
        person: relatedPerson,
        canAddParent: true,
        origin: "merged",
        onRename: handlePreviewRename,
        onDelete: handlePreviewDelete,
        onAddRelated: (...args) => handlePreviewAddRelatedRef.current(...args),
      },
    }]);
    setPreviewEdges((current) => [...current, {
      id: connectionId,
      source,
      target,
      type: "connection",
      deletable: false,
      data: { onRemove: handlePreviewRemove, origin: "merged" },
      style: { stroke: "#39714c", strokeWidth: 1.8 },
    }]);
  }, [
    handlePreviewDelete,
    handlePreviewRemove,
    handlePreviewRename,
    setPreviewEdges,
    setPreviewNodes,
    treeAId,
  ]);
  useEffect(() => {
    handlePreviewAddRelatedRef.current = handlePreviewAddRelated;
  }, [handlePreviewAddRelated]);

  function handlePreviewConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    setPreviewEdges((current) => addEdge({
      ...connection,
      id: `${connection.source}-${connection.target}`,
      type: "connection",
      deletable: false,
      data: { onRemove: handlePreviewRemove, origin: "merged" },
      style: { stroke: "#39714c", strokeWidth: 1.8 },
    }, current));
  }

  function handleResetPreviewLayout() {
    const origins = new Map(previewNodes.map((node) => [node.id, node.data.origin]));
    const resetNodes = arrangePeople(
      previewNodes.map((node) => node.data.person),
      previewEdges,
      {},
      handlePreviewRename,
      handlePreviewDelete,
      handlePreviewAddRelated,
    ).map((node) => ({
      ...node,
      data: { ...node.data, origin: origins.get(node.id) },
    }));
    setPreviewNodes(resetNodes);
  }

  function handleDeletePreviewSelection() {
    const selectedNodeIds = new Set(
      previewNodes.filter((node) => node.selected).map((node) => node.id),
    );
    const selectedEdgeIds = new Set(
      previewEdges.filter((edge) => edge.selected).map((edge) => edge.id),
    );
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    setPreviewNodes((current) => current.filter((node) => !selectedNodeIds.has(node.id)));
    setPreviewEdges((current) => current.filter((edge) =>
      !selectedEdgeIds.has(edge.id) &&
      !selectedNodeIds.has(edge.source) &&
      !selectedNodeIds.has(edge.target),
    ));
  }

  function resetReview() {
    setCandidates(null);
    setDecisions({});
    setReviewMode(null);
    setPreviewReady(false);
    setPreviewNodes([]);
    setPreviewEdges([]);
    setError(null);
  }

  async function compareTrees() {
    if (!treeAId || !treeBId || treeAId === treeBId) return;
    setComparing(true);
    resetReview();
    try {
      const result = await getMatchCandidates(treeAId, treeBId);
      setCandidates(result);
      setDecisions(Object.fromEntries(result.map((candidate) => [candidateKey(candidate), {
        accepted: null,
        birthYearSide: null,
        deathYearSide: null,
      }])));
      if (result.length === 0) setReviewMode("manual");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setComparing(false);
    }
  }

  function selectBulkReview() {
    if (!candidates) return;
    setReviewMode("bulk");
    setDecisions(Object.fromEntries(candidates.map((candidate) => [candidateKey(candidate), {
      accepted: true,
      birthYearSide: preferredSide,
      deathYearSide: preferredSide,
    }])));
    setPreviewReady(false);
  }

  function selectManualReview() {
    if (!candidates) return;
    setReviewMode("manual");
    setDecisions(Object.fromEntries(candidates.map((candidate) => [candidateKey(candidate), {
      accepted: null,
      birthYearSide: null,
      deathYearSide: null,
    }])));
    setPreviewReady(false);
  }

  function changePreferredSide(side: TreeSide) {
    setPreferredSide(side);
    if (reviewMode === "bulk" && candidates) {
      setDecisions(Object.fromEntries(candidates.map((candidate) => [candidateKey(candidate), {
        accepted: true,
        birthYearSide: side,
        deathYearSide: side,
      }])));
    }
    setPreviewReady(false);
  }

  function updateDecision(key: string, update: Partial<CandidateDecision>) {
    setDecisions((current) => {
      const previous = current[key];
      const yearSourceChanged = previous && (
        (update.birthYearSide !== undefined && update.birthYearSide !== previous.birthYearSide) ||
        (update.deathYearSide !== undefined && update.deathYearSide !== previous.deathYearSide)
      );
      return {
        ...current,
        [key]: {
          ...previous,
          ...update,
          ...(yearSourceChanged && previous.accepted === true ? { accepted: null } : {}),
        },
      };
    });
    setPreviewReady(false);
  }

  async function showPreview() {
    if (!candidates || !treeA || !treeB) return;
    const undecided = candidates.some((candidate) =>
      decisions[candidateKey(candidate)]?.accepted === null,
    );
    if (undecided) {
      setError("Choose accept or reject for every candidate before previewing.");
      return;
    }

    const accepted = candidates.filter((candidate) =>
      decisions[candidateKey(candidate)]?.accepted === true,
    );
    const usedA = new Set<string>();
    const usedB = new Set<string>();
    const hasOverlappingMatches = accepted.some((candidate) => {
      if (usedA.has(candidate.personA.id) || usedB.has(candidate.personB.id)) return true;
      usedA.add(candidate.personA.id);
      usedB.add(candidate.personB.id);
      return false;
    });
    if (hasOverlappingMatches) {
      setError("Some accepted matches reuse a person. Switch to individual review and reject the overlapping candidates.");
      return;
    }

    setPreviewing(true);
    setPreviewReady(false);
    setError(null);
    try {
      const [graphA, graphB] = await Promise.all([
        loadTreeGraph(treeA.id),
        loadTreeGraph(treeB.id),
      ]);
      const previewGraph = buildPreview(graphA, graphB, candidates, decisions, {
        onRename: handlePreviewRename,
        onDelete: handlePreviewDelete,
        onAddRelated: handlePreviewAddRelated,
        onRemove: handlePreviewRemove,
      });
      setPreviewNodes(previewGraph.nodes);
      setPreviewEdges(previewGraph.edges);
      setPreviewReady(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPreviewing(false);
    }
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

  const allDecisionsMade = Boolean(candidates) && candidates!.every((candidate) =>
    decisions[candidateKey(candidate)]?.accepted !== null,
  );
  const acceptedCount = candidates?.filter((candidate) =>
    decisions[candidateKey(candidate)]?.accepted === true,
  ).length ?? 0;
  const selectedPreviewCount = previewNodes.filter((node) => node.selected).length +
    previewEdges.filter((edge) => edge.selected).length;
  const treeName = (side: TreeSide) => side === "a" ? treeA?.name ?? "Tree A" : treeB?.name ?? "Tree B";

  return (
    <main className="tree-comparison-page">
      <header className="comparison-header">
        <Link className="comparison-brand" to="/trees">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>
            <span className="eyebrow">Family archive</span>
            <strong>Roots &amp; Branches</strong>
          </span>
        </Link>
        <nav aria-label="Family tree pages">
          <Link to="/trees">Tree editor</Link>
          <span aria-current="page">Compare trees</span>
        </nav>
      </header>

      <section className="comparison-setup" aria-labelledby="comparison-title">
        <div>
          <p className="eyebrow">Family archive</p>
          <h1 id="comparison-title">Compare family trees</h1>
        </div>
        <div className="comparison-tree-selectors">
          <label>
            <span>Tree A</span>
            <select value={treeAId} onChange={(event) => { setTreeAId(event.target.value); resetReview(); }} disabled={treesLoading}>
              <option value="">Choose a tree</option>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
            </select>
          </label>
          <span className="comparison-versus" aria-hidden="true">&amp;</span>
          <label>
            <span>Tree B</span>
            <select value={treeBId} onChange={(event) => { setTreeBId(event.target.value); resetReview(); }} disabled={treesLoading}>
              <option value="">Choose a tree</option>
              {trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}
            </select>
          </label>
          <button
            className="comparison-primary-button"
            type="button"
            onClick={() => void compareTrees()}
            disabled={treesLoading || comparing || !treeAId || !treeBId || treeAId === treeBId}
          >
            {comparing ? "Comparing..." : "Compare"}
          </button>
        </div>
        {treeAId && treeAId === treeBId && <p className="comparison-inline-error" role="alert">Choose two different trees.</p>}
        {trees.length < 2 && !treesLoading && <p className="comparison-muted">Create another tree to compare.</p>}
      </section>

      {error && <p className="comparison-error" role="alert">{error}</p>}

      {candidates !== null && (
        <section className="comparison-review" aria-labelledby="review-title">
          <div className="comparison-section-heading">
            <div>
              <p className="eyebrow">Review</p>
              <h2 id="review-title">{candidates.length} match {candidates.length === 1 ? "candidate" : "candidates"}</h2>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="comparison-muted">No possible matches were found. The preview will show both trees without merged people.</p>
          ) : (
            <>
              <div className="comparison-review-modes">
                <label className="comparison-preferred-source">
                  <span>Preferred details for bulk acceptance</span>
                  <select value={preferredSide} onChange={(event) => changePreferredSide(event.target.value as TreeSide)}>
                    <option value="a">{treeName("a")}</option>
                    <option value="b">{treeName("b")}</option>
                  </select>
                </label>
                <button className="comparison-secondary-button" type="button" onClick={selectBulkReview}>
                  Accept all {candidates.length} matches
                </button>
                <button className="comparison-secondary-button" type="button" onClick={selectManualReview}>
                  Review individually
                </button>
              </div>

              {reviewMode === "bulk" && (
                <p className="comparison-mode-note">
                  All candidates are selected. Person details use {treeName(preferredSide)} where values differ.
                </p>
              )}

              {reviewMode === "manual" && (
                <div className="comparison-candidate-list">
                  {candidates.map((candidate) => {
                    const key = candidateKey(candidate);
                    const decision = decisions[key] ?? {
                      accepted: null,
                      birthYearSide: null,
                      deathYearSide: null,
                    };
                    const sameBirthYear = candidate.personA.birthYear === candidate.personB.birthYear;
                    const sameDeathYear = candidate.personA.deathYear === candidate.personB.deathYear;
                    const canAccept = (sameBirthYear || decision.birthYearSide !== null) &&
                      (sameDeathYear || decision.deathYearSide !== null);
                    return (
                      <article className="comparison-candidate" key={key}>
                        <div className="comparison-candidate-heading">
                          <div>
                            <h3>{candidate.personA.firstName} {candidate.personA.lastName}</h3>
                            <p>{treeName("a")} <span aria-hidden="true">↔</span> {treeName("b")}</p>
                          </div>
                        </div>

                        <div className="comparison-field-choices">
                            {sameBirthYear ? (
                              <p><strong>Birth year</strong><span>{yearText(candidate.personA.birthYear)}</span></p>
                            ) : (
                              <fieldset>
                                <legend>Birth year</legend>
                                {(["a", "b"] as const).map((side) => (
                                  <label key={side}>
                                    <input
                                      type="radio"
                                      name={`${key}-birth`}
                                      checked={decision.birthYearSide === side}
                                      onChange={() => updateDecision(key, { birthYearSide: side })}
                                    />
                                    {treeName(side)}: {yearText(side === "a" ? candidate.personA.birthYear : candidate.personB.birthYear)}
                                  </label>
                                ))}
                              </fieldset>
                            )}
                            {sameDeathYear ? (
                              <p><strong>Death year</strong><span>{yearText(candidate.personA.deathYear)}</span></p>
                            ) : (
                              <fieldset>
                                <legend>Death year</legend>
                                {(["a", "b"] as const).map((side) => (
                                  <label key={side}>
                                    <input
                                      type="radio"
                                      name={`${key}-death`}
                                      checked={decision.deathYearSide === side}
                                      onChange={() => updateDecision(key, { deathYearSide: side })}
                                    />
                                    {treeName(side)}: {yearText(side === "a" ? candidate.personA.deathYear : candidate.personB.deathYear)}
                                  </label>
                                ))}
                              </fieldset>
                            )}
                        </div>
                        <div className="comparison-choice-buttons" aria-label="Match decision">
                          <button
                            className={decision.accepted === true ? "is-accepted" : ""}
                            type="button"
                            aria-pressed={decision.accepted === true}
                            disabled={!canAccept}
                            onClick={() => updateDecision(key, { accepted: true })}
                          >Accept</button>
                          <button
                            className={decision.accepted === false ? "is-rejected" : ""}
                            type="button"
                            aria-pressed={decision.accepted === false}
                            onClick={() => updateDecision(key, { accepted: false })}
                          >Reject</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="comparison-preview-action">
            <button
              className="comparison-primary-button"
              type="button"
              onClick={() => void showPreview()}
              disabled={previewing || (candidates.length > 0 && (reviewMode === null || !allDecisionsMade))}
            >
              {previewing ? "Building preview..." : "Preview tree"}
            </button>
            <span>Preview only. No tree will be changed or saved.</span>
          </div>
        </section>
      )}

      {previewReady && (
        <section className="comparison-preview" aria-labelledby="preview-title">
          <div className="comparison-section-heading">
            <div>
              <p className="eyebrow">Preview only</p>
              <h2 id="preview-title">{treeA?.name} + {treeB?.name}</h2>
            </div>
            <div className="comparison-legend" aria-label="Person origins">
              <span><i className="legend-swatch legend-tree-a" />{treeA?.name}</span>
              <span><i className="legend-swatch legend-tree-b" />{treeB?.name}</span>
              <span><i className="legend-swatch legend-merged" />Matched</span>
              <button
                className="layout-reset-button"
                type="button"
                onClick={handleResetPreviewLayout}
                disabled={previewNodes.length === 0}
              >
                Reset layout
              </button>
            </div>
          </div>
          {previewNodes.length === 0 ? (
            <p className="comparison-muted">Both trees are empty.</p>
          ) : (
            <div className="comparison-preview-canvas">
              <ReactFlow<PersonTreeNode, FamilyTreeEdge>
                nodes={previewNodes}
                edges={previewEdges}
                nodeTypes={previewNodeTypes}
                edgeTypes={previewEdgeTypes}
                onNodesChange={onPreviewNodesChange}
                onEdgesChange={onPreviewEdgesChange}
                onConnect={handlePreviewConnect}
                selectionOnDrag
                selectionMode={SelectionMode.Partial}
                panOnDrag={[1, 2]}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.2}
                maxZoom={1.2}
              >
                {selectedPreviewCount > 0 && (
                  <Panel position="top-left" className="selection-action-panel">
                    <button
                      className="selection-delete-button"
                      type="button"
                      onClick={handleDeletePreviewSelection}
                    >
                      <span className="connection-delete-icon" aria-hidden="true" />
                      Delete selected ({selectedPreviewCount})
                    </button>
                  </Panel>
                )}
                <Background color="#c6d0c2" gap={28} size={1} />
                <Controls position="bottom-right" />
              </ReactFlow>
            </div>
          )}
          <p className="comparison-preview-count">{acceptedCount} matched · {previewNodes.length} people · {previewEdges.length} connections</p>
        </section>
      )}
    </main>
  );
}