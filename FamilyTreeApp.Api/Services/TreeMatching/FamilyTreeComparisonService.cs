namespace FamilyTreeApp.Api.Services.TreeMatching;

using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Relationships;
using FamilyTreeApp.Api.Services.CurrentUser;
using Microsoft.EntityFrameworkCore;
using FamilyTreeApp.Api.Dtos.TreeMatching;
using FamilyTreeApp.Api.Dtos.Persons;

public class FamilyTreeComparisonService(AppDbContext dbContext, IUserContext userContext) : IFamilyTreeComparisonService
{
    private readonly AppDbContext _dbContext = dbContext;
    private readonly IUserContext _userContext = userContext;

    public async Task<List<MatchCandidates>> GetMatchCandidates(Guid treeAId, Guid treeBId)
    {
        var personsA = await GetPersonsByFamilyTreeId(treeAId);
        var personsB = await GetPersonsByFamilyTreeId(treeBId);

        var relationshipsA = await GetRelationshipsByFamilyTreeIdAsync(treeAId);
        var relationshipsB = await GetRelationshipsByFamilyTreeIdAsync(treeBId);

        var graphA = BuildGraph(personsA, relationshipsA);
        var graphB = BuildGraph(personsB, relationshipsB);

        return GenerateMatchCandidates(graphA, graphB);        
    }

    private async Task<List<PersonDto>> GetPersonsByFamilyTreeId(Guid id)
    {
        var userId = _userContext.UserId;

        var persons = await _dbContext.Persons
            .Where(p => p.FamilyTreeId == id && p.FamilyTree.OwnerId == userId)
            .Select(p => new PersonDto
            {
                Id = p.Id,
                FirstName = p.FirstName,
                LastName = p.LastName,
                BirthYear = p.BirthYear,
                DeathYear = p.DeathYear,
                FamilyTreeId = p.FamilyTreeId
            })
            .ToListAsync();

        return persons;
    }

    private async Task<List<RelationshipDto>> GetRelationshipsByFamilyTreeIdAsync(Guid id)
    {
        var relationships = await _dbContext.ParentChildRelationships
        .Where(r => r.Parent.FamilyTreeId == id)
        .Select(r => new RelationshipDto
        {
            ParentId = r.ParentId,
            ChildId = r.ChildId
        })
        .ToListAsync();

        return relationships;
    }

    private class FamilyTreeGraph
    {
        public List<PersonDto> Persons { get; init; } = [];
        public List<RelationshipDto> Relationships { get; init; } = [];
        public Dictionary<Guid, PersonDto> PersonsById { get; init; } = [];
        public Dictionary<(string FirstName, string LastName), List<PersonDto>> PersonsByName { get; init; } = [];
        public Dictionary<(string FirstName, string LastName, int? BirthYear), List<PersonDto>> PersonsByNameAndBirthYear { get; init; } = [];
        public Dictionary<Guid, HashSet<Guid>> ParentsByChild { get; init; } = [];
        public Dictionary<Guid, HashSet<Guid>> ChildrenByParent { get; init; } = [];
    }

    private FamilyTreeGraph BuildGraph(
        List<PersonDto> persons,
        List<RelationshipDto> relationships)
    {
        var graph = new FamilyTreeGraph
        {
            Persons = persons,
            Relationships = relationships,

            PersonsById = persons.ToDictionary(p => p.Id),

            PersonsByName = persons
                .GroupBy(p => (p.FirstName, p.LastName))
                .ToDictionary(g => g.Key, g => g.ToList()),

            PersonsByNameAndBirthYear = persons
                .GroupBy(p => (p.FirstName, p.LastName, p.BirthYear))
                .ToDictionary(g => g.Key, g => g.ToList()),

            ParentsByChild = relationships
                .GroupBy(r => r.ChildId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(r => r.ParentId).ToHashSet()),

            ChildrenByParent = relationships
                .GroupBy(r => r.ParentId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(r => r.ChildId).ToHashSet())
        };

        return graph;
    }

    private List<MatchCandidates> GenerateMatchCandidates(
        FamilyTreeGraph graphA,
        FamilyTreeGraph graphB)
    {
        var candidates = new List<MatchCandidates>();

        foreach (var personA in graphA.Persons)
        {
            var nameKey = (personA.FirstName, personA.LastName);

            // match by name
            if (!graphB.PersonsByName.TryGetValue(nameKey, out var personsB))
                continue;
            
            // check if parents match
            foreach (var personB in personsB)
            {
                var parentsA = graphA.ParentsByChild.GetValueOrDefault(personA.Id) ?? [];
                var parentsB = graphB.ParentsByChild.GetValueOrDefault(personB.Id) ?? [];
                
                if (parentsA.Count == 0 || parentsB.Count == 0)
                {
                    candidates.Add(new MatchCandidates
                    {
                        PersonAId = personA.Id,
                        PersonBId = personB.Id,
                    });
                }
                else
                {
                    int parent_matches = 0;

                    foreach (var parentAId in parentsA)
                    {
                        var parentA = graphA.PersonsById[parentAId];

                        foreach (var parentBId in parentsB)
                        {
                            var parentB = graphB.PersonsById[parentBId];

                            if (parentA.FirstName == parentB.FirstName && parentA.LastName == parentB.LastName) parent_matches += 1;
                        }
                    }
                    
                    if (parent_matches == Math.Min(parentsA.Count, parentsB.Count))
                    {
                        candidates.Add(new MatchCandidates
                        {
                            PersonAId = personA.Id,
                            PersonBId = personB.Id,
                        });
                    }

                }
            }
        }

        return candidates;
    }
}