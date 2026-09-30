import { api } from "./api";

export type FamilyTree = {
  id: string;
  name: string;
  ownerId: string;
};

export async function getFamilyTrees() {
  const response = await api.get<FamilyTree[]>("/familytrees");
  return response.data;
}

export async function createFamilyTree(name: string) {
  const response = await api.post<FamilyTree>("/familytrees", { name });
  return response.data;
}

export async function updateFamilyTree(treeId: string, name: string) {
  await api.put(`/familytrees/${treeId}`, { name });
}

export async function deleteFamilyTree(treeId: string) {
  await api.delete(`/familytrees/${treeId}`);
}