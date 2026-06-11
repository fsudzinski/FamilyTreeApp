namespace FamilyTreeApp.Api.Dtos.FamilyTrees;
using System.ComponentModel.DataAnnotations;

public class CreateFamilyTreeDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    [Required]
    public string OwnerId { get; set; } = string.Empty;
}