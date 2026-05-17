namespace FamilyTreeApp.Api.Entities;

public class ParentChild
{
    public Person Parent { get; set; } = null!;
    public Guid ParentId;
    public Person Child { get; set; } = null!;
    public Guid ChildId;
}