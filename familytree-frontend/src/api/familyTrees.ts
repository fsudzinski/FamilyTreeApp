import { api } from "./api";

export type TreeVisibility = 0 | 1;

export type FamilyTree = {
  id: string;
  name: string;
  ownerId: string;
  visibility: TreeVisibility;
};

export async function getFamilyTrees() {
  const response = await api.get<FamilyTree[]>("/familytrees");
  return response.data;
}

export async function createFamilyTree(name: string, visibility: TreeVisibility = 0) {
  const response = await api.post<FamilyTree>("/familytrees", { name, visibility });
  return response.data;
}

export async function updateFamilyTree(treeId: string, name: string, visibility: TreeVisibility) {
  await api.put(`/familytrees/${treeId}`, { name, visibility });
}

export async function deleteFamilyTree(treeId: string) {
  await api.delete(`/familytrees/${treeId}`);
}