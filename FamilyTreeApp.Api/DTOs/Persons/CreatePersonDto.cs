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

    [Required]
    public Guid FamilyTreeId { get; set; }
}