namespace FamilyTreeApp.Api.Dtos.FamilyTrees;

public class FamilyTreeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
}