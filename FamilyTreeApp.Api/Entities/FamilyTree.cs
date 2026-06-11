namespace FamilyTreeApp.Api.Entities;

public class FamilyTree
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
    public ApplicationUser Owner { get; set; } = null!;
    public List<Person> People { get; set; } = [];
}