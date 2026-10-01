namespace FamilyTreeApp.Api.Dtos.Persons;

public class PersonDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    public int? DeathYear { get; set; }
    public Guid FamilyTreeId { get; set; }
}