using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Persons;
using FamilyTreeApp.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/persons")]
public class PersonsController(AppDbContext dbContext) : ControllerBase
{
    private readonly AppDbContext _dbContext = dbContext;

    [HttpPost]
    public async Task<IActionResult> CreatePerson(CreatePersonDto dto)
    {
        var familyTreeExists = await _dbContext.FamilyTrees
            .AnyAsync(ft => ft.Id == dto.FamilyTreeId);

        if (!familyTreeExists)
            return NotFound("Family tree not found.");
        
        var person = new Person
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName.Trim(),
            LastName = dto.LastName.Trim(),
            FamilyTreeId = dto.FamilyTreeId
        };

        _dbContext.Persons.Add(person);
        await _dbContext.SaveChangesAsync();

        var result = new PersonDto
        {
            Id = person.Id,
            FirstName = person.FirstName,
            LastName = person.LastName,
            FamilyTreeId = person.FamilyTreeId
        };

        return CreatedAtAction(
            nameof(GetPersonById),
            new { id = person.Id },
            result
        );
    }

    [HttpGet]
    public async Task<IActionResult> GetPersons()
    {
        var persons = await _dbContext.Persons
        .Select(p => new PersonDto
        {
            Id = p.Id,
            FirstName = p.FirstName,
            LastName = p.LastName,
            FamilyTreeId = p.FamilyTreeId
        })
        .ToListAsync();

        return Ok(persons);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPersonById(Guid id)
    {
        var person = await _dbContext.Persons
        .Where(p => p.Id == id)
        .Select(p => new PersonDto
        {
            Id = p.Id,
            FirstName = p.FirstName,
            LastName = p.LastName,
            FamilyTreeId = p.FamilyTreeId
        })
        .FirstOrDefaultAsync();

        if (person == null)
            return NotFound();

        return Ok(person);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdatePerson(Guid id, UpdatePersonDto dto)
    {
        var affectedRows = await _dbContext.Persons
            .Where(p => p.Id == id)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.FirstName, dto.FirstName.Trim())
                .SetProperty(p => p.LastName, dto.LastName.Trim())
            );

        if (affectedRows == 0)
            return NotFound();

        return NoContent();
    }
    
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePersonById(Guid id)
    {
        var deletedCount = await _dbContext.Persons
            .Where(p => p.Id == id)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
            return NotFound();

        return NoContent();
    }
}