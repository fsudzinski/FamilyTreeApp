namespace FamilyTreeApp.Api.Entities;

using FamilyTreeApp.Api.Enums;

public class FamilyTree
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public TreeVisibility Visibility { get; set; } = TreeVisibility.Private;
    public string OwnerId { get; set; } = string.Empty;
    public ApplicationUser Owner { get; set; } = null!;
    public List<Person> People { get; set; } = [];
}