namespace FamilyTreeApp.Api.Dtos;

public class CreateFamilyTreeDto
{
    public string Name { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
}