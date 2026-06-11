using Microsoft.AspNetCore.Mvc;
using FamilyTreeApp.Api.Dtos.Relationships;
using FamilyTreeApp.Api.Services.Relationships;
using FamilyTreeApp.Api.Services.CurrentUser;
using Microsoft.AspNetCore.Authorization;

namespace FamilyTreeApp.Api.Controllers;

[ApiController]
[Route("api/relationships")]
public class RelationshipsController(IRelationshipService relationshipService) : ControllerBase
{
    private readonly IRelationshipService _relationshipService = relationshipService;

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreateRelationship(CreateRelationshipDto dto)
    {
        try
        {
            var result = await _relationshipService.CreateRelationshipAsync(dto);

            return CreatedAtAction(
                nameof(GetRelationship),
                new
                {
                    parentId = result.ParentId,
                    childId = result.ChildId
                },
                result
            );
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(exception.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return NotFound();
        }
    }

    // TODO check if unnecessary
    // [HttpGet]
    // public async Task<IActionResult> GetRelationships()
    // {
    //     var relationships = await _relationshipService.GetRelationshipsAsync();

    //     return Ok(relationships);
    // }

    [HttpGet("{parentId:guid}/{childId:guid}")]
    [Authorize]
    public async Task<IActionResult> GetRelationship(Guid parentId, Guid childId)
    {
        try {
            var relationship = await _relationshipService.GetRelationshipAsync(parentId, childId);
            
            return Ok(relationship);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{parentId:guid}/{childId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteRelationship(Guid parentId, Guid childId)
    {
        try {
            await _relationshipService.DeleteRelationshipAsync(parentId, childId);
            
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return NotFound();
        }
    }

}