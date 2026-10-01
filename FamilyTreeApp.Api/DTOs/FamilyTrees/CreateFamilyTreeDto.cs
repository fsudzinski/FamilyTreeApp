namespace FamilyTreeApp.Api.Dtos.FamilyTrees;
using System.ComponentModel.DataAnnotations;
using FamilyTreeApp.Api.Enums;

public class CreateFamilyTreeDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    public TreeVisibility Visibility { get; set; }
}