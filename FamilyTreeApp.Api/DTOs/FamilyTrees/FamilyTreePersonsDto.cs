using FamilyTreeApp.Api.Dtos.Persons;

namespace FamilyTreeApp.Api.Dtos.FamilyTrees;

public class FamilyTreePersonsDto
{
    public Guid FamilyTreeeId { get; set; }
    public List<PersonDto> Persons { get; set; } = [];
}