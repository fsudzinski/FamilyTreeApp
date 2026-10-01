namespace FamilyTreeApp.Api.Dtos.Persons;
using System.ComponentModel.DataAnnotations;

public class CreatePersonDto
{
    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Range(1, 9999)]
    public int? BirthYear { get; set; }

    [Range(1, 9999)]
    public int? DeathYear { get; set; }

    [Required]
    public Guid FamilyTreeId { get; set; }
}