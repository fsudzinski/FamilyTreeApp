import { api } from "./api";

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  deathYear: number | null;
  familyTreeId?: string;
};

type FamilyTreePersonsResponse = {
  persons: Person[];
};

export async function getPeopleInTree(treeId: string) {
  const response = await api.get<FamilyTreePersonsResponse>(
    `/familytrees/${treeId}/persons`,
  );
  return response.data.persons;
}

export async function getPersonChildren(personId: string) {
  const response = await api.get<Person[]>(`/persons/${personId}/children`);
  return response.data;
}

export async function createPerson(person: {
  firstName: string;
  lastName: string;
  familyTreeId: string;
  birthYear?: number | null;
  deathYear?: number | null;
}) {
  const response = await api.post<Person>("/persons", person);
  return response.data;
}

export async function updatePerson(
  personId: string,
  person: {
    firstName: string;
    lastName: string;
    birthYear: number | null;
    deathYear: number | null;
  },
) {
  await api.put(`/persons/${personId}`, person);
}

export async function deletePerson(personId: string) {
  await api.delete(`/persons/${personId}`);
}