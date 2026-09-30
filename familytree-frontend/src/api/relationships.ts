import { api } from "./api";

export type ParentChildRelationship = {
  parentId: string;
  childId: string;
};

export async function createRelationship(relationship: ParentChildRelationship) {
  const response = await api.post<ParentChildRelationship>(
    "/relationships",
    relationship,
  );
  return response.data;
}