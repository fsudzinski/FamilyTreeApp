namespace FamilyTreeApp.Api.Entities;

using Microsoft.AspNetCore.Identity;

public class ApplicationUser : IdentityUser
{
    public List<FamilyTree> FamilyTrees { get; set; } = [];
}