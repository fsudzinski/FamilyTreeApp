import { api } from "./api";
import type { Person } from "./persons";

export type MatchCandidate = {
  personA: Person;
  personB: Person;
};

export async function getMatchCandidates(treeAId: string, treeBId: string) {
  const response = await api.get<MatchCandidate[]>(
    `/familytrees/${treeAId}/compare/${treeBId}`,
  );
  return response.data;
}