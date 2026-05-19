namespace FamilyTreeApp.Api.Dtos.FamilyTrees;
using System.ComponentModel.DataAnnotations;

public class UpdateFamilyTreeDto
{
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
}