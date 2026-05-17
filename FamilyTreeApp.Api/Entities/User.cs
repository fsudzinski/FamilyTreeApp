namespace FamilyTreeApp.Api.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public List<FamilyTree> FamilyTrees { get; set; } = [];
}