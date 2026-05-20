using System.ComponentModel.DataAnnotations;

namespace FamilyTreeApp.Api.Dtos.Relationships;

public class RelationshipDto
{
    public Guid ParentId { get; set; }
    public Guid ChildId { get; set; }
}