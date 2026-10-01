namespace FamilyTreeApp.Api.Entities;

public class Person
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    public int? DeathYear { get; set; }
    public Guid FamilyTreeId { get; set; }
    public FamilyTree FamilyTree { get; set; } = null!;
    public List<ParentChild> ParentRelationships { get; set; } = [];
    public List<ParentChild> ChildRelationships { get; set; } = [];
}