using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.FamilyTrees;
using FamilyTreeApp.Api.Dtos.Persons;
using FamilyTreeApp.Api.Entities;
using FamilyTreeApp.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/familytrees")]
public class FamilyTreesController(AppDbContext dbContext, UserContext userContext) : ControllerBase
{
    private readonly AppDbContext _dbContext = dbContext;
    private readonly UserContext _userContext = userContext;

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateFamilyTree(CreateFamilyTreeDto dto)
    {
        var userId = _userContext.UserId;

        // TODO exception if user has been deleted but token is still valid?

        var familyTree = new FamilyTree
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            OwnerId = userId
        };

        _dbContext.FamilyTrees.Add(familyTree);
        await _dbContext.SaveChangesAsync();

        var result = new FamilyTreeDto
        {
            Id = familyTree.Id,
            Name = familyTree.Name,
            OwnerId = familyTree.OwnerId
        };

        return CreatedAtAction(
            nameof(GetFamilyTreeById),
            new { id = familyTree.Id },
            result
        );
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetFamilyTrees()
    {
        var userId = _userContext.UserId;
        
        var familytrees = await _dbContext.FamilyTrees
        .Where(ft => ft.OwnerId == userId)
        .Select(ft => new FamilyTreeDto
        {
            Id = ft.Id,
            Name = ft.Name,
            OwnerId = ft.OwnerId
        })
        .ToListAsync();

        return Ok(familytrees);
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetFamilyTreeById(Guid id)
    {
        var userId = _userContext.UserId;
        
        var familyTree = await _dbContext.FamilyTrees
        .Where(ft => ft.Id == id && ft.OwnerId == userId)
        .Select(ft => new FamilyTreeDto
        {
            Id = ft.Id,
            Name = ft.Name,
            OwnerId = ft.OwnerId
        })
        .FirstOrDefaultAsync();

        if (familyTree is null)
            return NotFound();

        return Ok(familyTree);
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteFamilyTreeById(Guid id)
    {
        var userId = _userContext.UserId;
        
        var deletedCount = await _dbContext.FamilyTrees
            .Where(ft => ft.Id == id && ft.OwnerId == userId)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
            return NotFound();

        return NoContent();
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdateFamilyTree(Guid id, UpdateFamilyTreeDto dto)
    {
        var userId = _userContext.UserId;
        
        var affectedRows = await _dbContext.FamilyTrees
            .Where(ft => ft.Id == id && ft.OwnerId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(ft => ft.Name, dto.Name.Trim())
            );

        if (affectedRows == 0)
            return NotFound();

        return NoContent();
    }

    [HttpGet("{id:guid}/persons")]
    [Authorize]
    public async Task<IActionResult> GetPersonsByFamilyTreeId(Guid id)
    {
        var userId = _userContext.UserId;

        var persons = await _dbContext.Persons
            .Where(p => p.FamilyTreeId == id && p.FamilyTree.OwnerId == userId)
            .Select(p => new PersonDto
            {
                Id = p.Id,
                FirstName = p.FirstName,
                LastName = p.LastName,
                FamilyTreeId = p.FamilyTreeId
            })
            .ToListAsync();

        var familyTreePersons = new FamilyTreePersonsDto
        {
            FamilyTreeeId = id,
            Persons = persons
        };

        return Ok(familyTreePersons);
    }
}