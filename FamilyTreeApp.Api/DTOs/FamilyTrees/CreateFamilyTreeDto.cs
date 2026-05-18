namespace FamilyTreeApp.Api.Dtos.FamilyTrees;
using System.ComponentModel.DataAnnotations;

public class CreateFamilyTreeDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    public Guid OwnerId { get; set; }
}