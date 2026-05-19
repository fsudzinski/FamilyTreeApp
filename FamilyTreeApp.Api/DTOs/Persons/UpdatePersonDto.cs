namespace FamilyTreeApp.Api.Dtos.Persons;
using System.ComponentModel.DataAnnotations;

public class UpdatePersonDto
{
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;
}