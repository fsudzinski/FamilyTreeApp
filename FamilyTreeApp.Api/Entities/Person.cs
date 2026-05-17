namespace FamilyTreeApp.Api.Entities;

public class Person
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public FamilyTree FamilyTree { get; set; } = null!;
    public List<ParentChild> ParentRelationships { get; set; } = [];
    public List<ParentChild> ChildRelationships { get; set; } = [];
}