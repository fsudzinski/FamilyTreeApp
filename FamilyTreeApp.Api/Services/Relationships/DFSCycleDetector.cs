namespace FamilyTreeApp.Api.Services.Relationships;

public class DFSCycleDetector
{
    private readonly Dictionary<Guid, HashSet<Guid>> _adjacencyList = [];
    private HashSet<Guid> _visited = [];
    private HashSet<Guid> _recStack = [];

    public DFSCycleDetector(List<(Guid ParentId, Guid ChildId)> relationships)
    {
        MakeAdjacencyList(relationships);
    }

    private void MakeAdjacencyList(List<(Guid ParentId, Guid ChildId)> relationships)    {

        foreach ((Guid parentId, Guid childId) in relationships)
        {
            if (!_adjacencyList.ContainsKey(parentId))
            {
                _adjacencyList[parentId] = [];
            }

            _adjacencyList[parentId].Add(childId);
        }
    }

    public bool HasCycle()
    {
        foreach (var node in _adjacencyList.Keys)
        {
            if (Dfs(node))
                return true;
        }

        return false;
    }

    private bool Dfs(Guid nodeId)
    {
        if (_recStack.Contains(nodeId))
            return true;

        if (_visited.Contains(nodeId))
            return false;

        _visited.Add(nodeId);
        _recStack.Add(nodeId);

        if (_adjacencyList.TryGetValue(nodeId, out var neighbors))
        {
            foreach (var next in neighbors)
            {
                if (Dfs(next))
                    return true;
            }
        }

        _recStack.Remove(nodeId);
        return false;
    }
}