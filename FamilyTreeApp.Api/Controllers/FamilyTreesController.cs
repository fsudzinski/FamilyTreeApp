using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.FamilyTrees;
using FamilyTreeApp.Api.Dtos.Persons;
using FamilyTreeApp.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/familytrees")]
public class FamilyTreesController(AppDbContext dbContext) : ControllerBase
{
    private readonly AppDbContext _dbContext = dbContext;

    [HttpPost]
    public async Task<IActionResult> CreateFamilyTree(CreateFamilyTreeDto dto)
    {
        var familyTree = new FamilyTree
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            OwnerId = dto.OwnerId
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
    public async Task<IActionResult> GetFamilyTrees()
    {
        var familytrees = await _dbContext.FamilyTrees
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
    public async Task<IActionResult> GetFamilyTreeById(Guid id)
    {
        var familyTree = await _dbContext.FamilyTrees
        .Where(ft => ft.Id == id)
        .Select(ft => new FamilyTreeDto
        {
            Id = ft.Id,
            Name = ft.Name,
            OwnerId = ft.OwnerId
        })
        .FirstOrDefaultAsync();

        if (familyTree == null)
            return NotFound();

        return Ok(familyTree);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteFamilyTreeById(Guid id)
    {
        var deletedCount = await _dbContext.FamilyTrees
            .Where(ft => ft.Id == id)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
            return NotFound();

        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateFamilyTree(Guid id, UpdateFamilyTreeDto dto)
    {
        var affectedRows = await _dbContext.FamilyTrees
            .Where(ft => ft.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(ft => ft.Name, dto.Name.Trim())
            );

        if (affectedRows == 0)
            return NotFound();

        return NoContent();
    }

    [HttpGet("{id:guid}/persons")]
    public async Task<IActionResult> GetPersonsByFamilyTreeId(Guid id)
    {
        var familyTreeExists = await _dbContext.FamilyTrees
            .AnyAsync(ft => ft.Id == id);

        if (!familyTreeExists)
            return NotFound("Family tree not found.");

        var persons = await _dbContext.Persons
            .Where(p => p.FamilyTreeId == id)
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