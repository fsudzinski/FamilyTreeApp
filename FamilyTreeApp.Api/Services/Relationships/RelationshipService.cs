using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Persons;
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
        // Check if different person
        if (dto.ParentId == dto.ChildId)
            throw new InvalidOperationException("Parent and child cannot be the same person.");

        // Check if parent exists
        var parent = await _dbContext.Persons
            .Where(p => p.Id == dto.ParentId)
            .Select(p => new { p.Id, p.FamilyTreeId })
            .FirstOrDefaultAsync();

        if (parent == null)
            throw new KeyNotFoundException("Parent not found.");

        // Check if child exists
        var child = await _dbContext.Persons
            .Where(p => p.Id == dto.ChildId)
            .Select(p => new { p.Id, p.FamilyTreeId })
            .FirstOrDefaultAsync();

        if (child == null)
            throw new KeyNotFoundException("Child not found.");

        // Check if parent and child belong to same tree
        if (parent.FamilyTreeId != child.FamilyTreeId)
            throw new InvalidOperationException(
                "Parent and child must belong to the same family tree.");

        // Check if relationship exists
        var exists = await _dbContext.ParentChildRelationships
            .Where(r => (r.ParentId == dto.ParentId && r.ChildId == dto.ChildId)
                || (r.ParentId == dto.ChildId && r.ChildId == dto.ParentId))
            .AnyAsync();

        if (exists)
            throw new InvalidOperationException("Persons already related.");

        // Check if max 2 parents
        var parentsCount = await _dbContext.ParentChildRelationships
            .Where(r => r.ChildId == dto.ChildId)
            .CountAsync();

        if (parentsCount >= 2)
            throw new InvalidOperationException("Child already has 2 parents.");

        // Cycle detection
        var relationships = await _dbContext.ParentChildRelationships
            .Where(r => r.Parent.FamilyTreeId == parent.FamilyTreeId)
            .AsNoTracking()
            .ToListAsync();

        var edges = relationships
            .Select(r => (r.ParentId, r.ChildId))
            .ToList();

        edges.Add((dto.ParentId, dto.ChildId));

        DFSCycleDetector cycleDetector = new(edges);

        if (cycleDetector.HasCycle())
            throw new InvalidOperationException("A person cannot become it's own ancestor");

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
}