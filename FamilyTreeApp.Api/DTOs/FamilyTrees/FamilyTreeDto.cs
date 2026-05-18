namespace FamilyTreeApp.Api.Dtos.FamilyTrees;

public class FamilyTreeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
}