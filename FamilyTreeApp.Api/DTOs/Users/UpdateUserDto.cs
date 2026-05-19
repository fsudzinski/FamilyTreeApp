namespace FamilyTreeApp.Api.Dtos.Users;
using System.ComponentModel.DataAnnotations;

public class UpdateUserDto
{
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;
}