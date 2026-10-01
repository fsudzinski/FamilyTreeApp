namespace FamilyTreeApp.Api.Dtos.FamilyTrees;
using FamilyTreeApp.Api.Enums;

public class FamilyTreeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
    public TreeVisibility Visibility { get; set; }
}