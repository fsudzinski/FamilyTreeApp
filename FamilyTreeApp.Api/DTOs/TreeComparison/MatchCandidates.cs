namespace FamilyTreeApp.Api.Dtos.TreeComparison;

using FamilyTreeApp.Api.Dtos.Persons;

public class MatchCandidates
{
    public PersonDto PersonA { get; init; } = null!;
    public PersonDto PersonB { get; init; } = null!;
}