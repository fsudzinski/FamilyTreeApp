namespace FamilyTreeApp.Api.Entities;

public class FamilyTree
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public List<Person> People { get; set; } = [];
}