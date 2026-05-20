using System.ComponentModel.DataAnnotations;

namespace FamilyTreeApp.Api.Dtos.Relationships;

public class CreateRelationshipDto
{
    [Required]
    public Guid ParentId { get; set; }

    [Required]
    public Guid ChildId { get; set; }
}