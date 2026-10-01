namespace FamilyTreeApp.Api.Dtos.TreeMatching;

public interface IFamilyTreeComparisonService
{
    public Task<List<MatchCandidates>> GetMatchCandidates(Guid treeAId, Guid treeBId);
}