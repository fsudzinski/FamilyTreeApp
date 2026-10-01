using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Persons;
using FamilyTreeApp.Api.Entities;
using FamilyTreeApp.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/persons")]
public class PersonsController(AppDbContext dbContext, IUserContext userContext) : ControllerBase
{
    private readonly AppDbContext _dbContext = dbContext;
    private readonly IUserContext _userContext = userContext;

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreatePerson(CreatePersonDto dto)
    {
        var userId = _userContext.UserId;
        
        var familyTreeExists = await _dbContext.FamilyTrees
            .AnyAsync(ft => ft.Id == dto.FamilyTreeId && ft.OwnerId == userId);

        if (!familyTreeExists)
            return NotFound("Family tree not found.");
        
        var person = new Person
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            BirthYear = dto.BirthYear,
            DeathYear = dto.DeathYear,
            FamilyTreeId = dto.FamilyTreeId
        };

        _dbContext.Persons.Add(person);
        await _dbContext.SaveChangesAsync();

        var result = new PersonDto
        {
            Id = person.Id,
            FirstName = person.FirstName,
            LastName = person.LastName,
            BirthYear = person.BirthYear,
            DeathYear = person.DeathYear,
            FamilyTreeId = person.FamilyTreeId
        };

        return CreatedAtAction(
            nameof(GetPersonById),
            new { id = person.Id },
            result
        );
    }

    // TODO unnecessary?
    // [HttpGet]
    // [Authorize]
    // public async Task<IActionResult> GetPersons()
    // {
    //     var userId = _userContext.UserId;

    //     var persons = await _dbContext.Persons
    //     .Where(p => p.FamilyTree.OwnerId == userId)
    //     .Select(p => new PersonDto
    //     {
    //         Id = p.Id,
    //         FirstName = p.FirstName,
    //         LastName = p.LastName,
    //         FamilyTreeId = p.FamilyTreeId
    //     })
    //     .ToListAsync();

    //     return Ok(persons);
    // }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetPersonById(Guid id)
    {
        var userId = _userContext.UserId;
        
        var person = await _dbContext.Persons
        .Where(p => p.Id == id && p.FamilyTree.OwnerId == userId)
        .Select(p => new PersonDto
        {
            Id = p.Id,
            FirstName = p.FirstName,
            LastName = p.LastName,
            BirthYear = p.BirthYear,
            DeathYear = p.DeathYear,
            FamilyTreeId = p.FamilyTreeId
        })
        .FirstOrDefaultAsync();

        if (person is null)
            return NotFound();

        return Ok(person);
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> UpdatePerson(Guid id, UpdatePersonDto dto)
    {
        var userId = _userContext.UserId;

        var affectedRows = await _dbContext.Persons
            .Where(p => p.Id == id && p.FamilyTree.OwnerId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.FirstName, dto.FirstName.Trim())
                .SetProperty(p => p.LastName, dto.LastName.Trim())
                .SetProperty(p => p.BirthYear, dto.BirthYear)
                .SetProperty(p => p.DeathYear, dto.DeathYear)
            );

        if (affectedRows == 0)
            return NotFound();

        return NoContent();
    }
    
    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> DeletePersonById(Guid id)
    {
        var userId = _userContext.UserId;

        var personExists = await _dbContext.Persons
            .AnyAsync(p => p.Id == id && p.FamilyTree.OwnerId == userId);

        if (!personExists)
            return NotFound();

        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        await _dbContext.ParentChildRelationships
            .Where(r => r.ParentId == id || r.ChildId == id)
            .ExecuteDeleteAsync();

        var deletedCount = await _dbContext.Persons
            .Where(p => p.Id == id && p.FamilyTree.OwnerId == userId)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
        {
            await transaction.RollbackAsync();
            return NotFound();
        }

        await transaction.CommitAsync();

        return NoContent();
    }

    [HttpGet("{id:guid}/parents")]
    [Authorize]
    public async Task<IActionResult> GetPersonParents(Guid id)
    {
        var userId = _userContext.UserId;
        
        var isTreeOwner = await _dbContext.Persons
            .AnyAsync(p => p.Id == id && p.FamilyTree.OwnerId == userId);

        if (!isTreeOwner)
            return NotFound();
        
        var parents = await _dbContext.ParentChildRelationships
            .Where(r => r.ChildId == id)
            .Select(r => new PersonDto
            {
                Id = r.Parent.Id,
                FirstName = r.Parent.FirstName,
                LastName = r.Parent.LastName,
                BirthYear = r.Parent.BirthYear,
                DeathYear = r.Parent.DeathYear
            })
            .ToListAsync();

        return Ok(parents);
    }

    [HttpGet("{id:guid}/children")]
    [Authorize]
    public async Task<IActionResult> GetPersonChildren(Guid id)
    {
        var userId = _userContext.UserId;
        
        var isTreeOwner = await _dbContext.Persons
            .AnyAsync(p => p.Id == id && p.FamilyTree.OwnerId == userId);

        if (!isTreeOwner)
            return NotFound();

        var children = await _dbContext.ParentChildRelationships
            .Where(r => r.ParentId == id)
            .Select(r => new PersonDto
            {
                Id = r.Child.Id,
                FirstName = r.Child.FirstName,
                LastName = r.Child.LastName,
                BirthYear = r.Child.BirthYear,
                DeathYear = r.Child.DeathYear
            })
            .ToListAsync();

        return Ok(children);
    }
}