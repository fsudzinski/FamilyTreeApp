using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Relationships;
using FamilyTreeApp.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Api.Services.Relationships;

public class RelationshipService : IRelationshipService
{
    private readonly AppDbContext _dbContext;

    public RelationshipService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RelationshipDto> CreateRelationshipAsync(CreateRelationshipDto dto)
    {
        if(dto.ParentId == dto.ChildId)            
            throw new InvalidOperationException("Can't be related to self.");

        var persons = await _dbContext.Persons
            .Where(p => p.Id == dto.ParentId || p.Id == dto.ChildId)
            .Select(p => new { p.Id, p.FamilyTreeId })
            .ToListAsync();

        var parent = persons.FirstOrDefault(p => p.Id == dto.ParentId);
        var child = persons.FirstOrDefault(p => p.Id == dto.ChildId);

        if (parent == null)
            throw new KeyNotFoundException("Parent not found.");

        if (child == null)
            throw new KeyNotFoundException("Child not found.");
        
       if (parent.FamilyTreeId != child.FamilyTreeId)
            throw new InvalidOperationException(
                "Parent and child must belong to the same family tree.");

        var exists = await _dbContext.ParentChildRelationships
            .AnyAsync(r =>
                (r.ParentId == dto.ParentId && r.ChildId == dto.ChildId) ||
                (r.ParentId == dto.ChildId && r.ChildId == dto.ParentId));

        if (exists)
            throw new InvalidOperationException("Persons already related.");
        
        var parentCount = await _dbContext.ParentChildRelationships
            .Where(r => r.ChildId == dto.ChildId)
            .CountAsync();

        if (parentCount >= 2)
            throw new InvalidOperationException("Child already has 2 parents.");

        await ValidateCycle(dto.ParentId, dto.ChildId, parent.FamilyTreeId);        

        var relationship = new ParentChild
        {
            ParentId = dto.ParentId,
            ChildId = dto.ChildId
        };

        _dbContext.ParentChildRelationships.Add(relationship);

        await _dbContext.SaveChangesAsync();

        return new RelationshipDto
        {
            ParentId = relationship.ParentId,
            ChildId = relationship.ChildId
        };
    }

    public async Task<List<RelationshipDto>> GetRelationshipsAsync()
    {
        var relationships = await _dbContext.ParentChildRelationships
        .Select(r => new RelationshipDto
        {
            ParentId = r.ParentId,
            ChildId = r.ChildId
        })
        .ToListAsync();
 
        return relationships;
    }

    public async Task<List<RelationshipDto>> GetRelationshipsByFamilyTreeIdAsync(Guid id)
    {
        var relationships = await _dbContext.ParentChildRelationships
        .Where(r => r.Parent.FamilyTreeId == id)
        .Select(r => new RelationshipDto
        {
            ParentId = r.ParentId,
            ChildId = r.ChildId
        })
        .ToListAsync();
 
        return relationships;
    }

    public async Task<RelationshipDto> GetRelationshipAsync(Guid parentId, Guid childId)
    {
        var relationship = await _dbContext.ParentChildRelationships
            .Where(p => p.ParentId == parentId)
            .Where(p => p.ChildId == childId)
            .AnyAsync();

        if (!relationship)
            throw new KeyNotFoundException("Child not found.");
        
        return new RelationshipDto
        {
            ParentId = parentId,
            ChildId = childId
        };
    }

    public async Task DeleteRelationshipAsync(Guid parentId, Guid childId)
    {
        var deletedCount = await _dbContext.ParentChildRelationships
            .Where(p => p.ParentId == parentId)
            .Where(p => p.ChildId == childId)
            .ExecuteDeleteAsync();

        if (deletedCount == 0)
            throw new KeyNotFoundException("Relationship not found");

        return;
    }
    private async Task ValidateCycle(Guid parentId, Guid childId, Guid familyTreeId)
    {
        var relationships = await _dbContext.ParentChildRelationships
            .Where(r => r.Parent.FamilyTreeId == familyTreeId)
            .AsNoTracking()
            .ToListAsync();

        var edges = relationships
            .Select(r => (r.ParentId, r.ChildId))
            .ToList();

        edges.Add((parentId, childId));

        DFSCycleDetector cycleDetector = new(edges);

        if (cycleDetector.HasCycle())
            throw new InvalidOperationException("A person cannot become it's own ancestor");
    }

}