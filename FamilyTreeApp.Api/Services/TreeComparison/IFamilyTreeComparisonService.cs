namespace FamilyTreeApp.Api.Dtos.TreeComparison;

public interface IFamilyTreeComparisonService
{
    public Task<List<MatchCandidates>> GetMatchCandidates(Guid treeAId, Guid treeBId);
}