namespace FamilyTreeApp.Api.Entities;

using Microsoft.AspNetCore.Identity;

public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public List<FamilyTree> FamilyTrees { get; set; } = [];
}