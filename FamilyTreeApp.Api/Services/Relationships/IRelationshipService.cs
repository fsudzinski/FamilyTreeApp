namespace FamilyTreeApp.Api.Services.Relationships;

using FamilyTreeApp.Api.Dtos.Relationships;

public interface IRelationshipService
{
    Task<RelationshipDto> CreateRelationshipAsync(CreateRelationshipDto dto);
    
    // TODO check if unnecessary
    // Task<List<RelationshipDto>> GetRelationshipsAsync();
    
    Task<RelationshipDto> GetRelationshipAsync(Guid parentId, Guid childId);
    Task DeleteRelationshipAsync(Guid parentId, Guid childId);
}