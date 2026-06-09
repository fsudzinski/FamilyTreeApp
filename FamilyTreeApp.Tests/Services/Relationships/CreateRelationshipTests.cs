using FamilyTreeApp.Api.Data;
using FamilyTreeApp.Api.Dtos.Relationships;
using FamilyTreeApp.Api.Entities;
using FamilyTreeApp.Api.Services.Relationships;
using Microsoft.EntityFrameworkCore;

namespace FamilyTreeApp.Tests.Services.Relationships;

public class CreateRelationshipTests
{
    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    [Fact]
    public async Task CreateRelationship_ShouldSucceed()
    {
        var db = CreateDbContext();

        var parent = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        var child = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = parent.FamilyTreeId
        };

        db.Persons.AddRange(parent, child);
        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = parent.Id,
            ChildId = child.Id
        };

        var result = await service.CreateRelationshipAsync(dto);

        Assert.Equal(parent.Id, result.ParentId);
        Assert.Equal(child.Id, result.ChildId);
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenSamePerson()
    {
        var db = CreateDbContext();
        var service = new RelationshipService(db);

        var id = Guid.NewGuid();

        var dto = new CreateRelationshipDto
        {
            ParentId = id,
            ChildId = id
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenChildNotExisting()
    {
        var db = CreateDbContext();

        var parent = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        db.Persons.AddRange(parent);
        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = parent.Id,
            ChildId = Guid.NewGuid()
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenParentNotExisting()
    {
        var db = CreateDbContext();

        var child = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        db.Persons.Add(child);
        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = Guid.NewGuid(),
            ChildId = child.Id
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenDifferentTrees()
    {
        var db = CreateDbContext();

        var parent = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        var child = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        db.Persons.AddRange(parent, child);
        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = parent.Id,
            ChildId = child.Id
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenAlreadyRelated()
    {
        var db = CreateDbContext();

        var parent = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        var child = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = parent.FamilyTreeId
        };

        db.Persons.AddRange(parent, child);

        var relationship = new ParentChild
        {
            ParentId = parent.Id,
            ChildId = child.Id
        };

        db.ParentChildRelationships.Add(relationship);

        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = parent.Id,
            ChildId = child.Id
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenMoreThanTwoParents()
    {
        var db = CreateDbContext();

        var parentA = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        var parentB = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = parentA.FamilyTreeId
        };

        var parentC = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = parentA.FamilyTreeId
        };

        var child = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = parentA.FamilyTreeId
        };

        db.Persons.AddRange(parentA, parentB, parentC, child);

        var relationshipA = new ParentChild
        {
            ParentId = parentA.Id,
            ChildId = child.Id
        };

        var relationshipB = new ParentChild
        {
            ParentId = parentB.Id,
            ChildId = child.Id
        };

        db.ParentChildRelationships.AddRange(relationshipA, relationshipB);

        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = parentC.Id,
            ChildId = child.Id
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateRelationshipAsync(dto));
    }

    [Fact]
    public async Task CreateRelationship_ShouldFail_WhenCycleDetected()
    {
        var db = CreateDbContext();

        var a = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = Guid.NewGuid()
        };

        var b = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = a.FamilyTreeId
        };

        var c = new Person
        {
            Id = Guid.NewGuid(),
            FamilyTreeId = a.FamilyTreeId
        };

        db.Persons.AddRange(a, b, c);

        var parentChildAB = new ParentChild
        {
            ParentId = a.Id,
            ChildId = b.Id
        };

        var parentChildBC = new ParentChild
        {
            ParentId = b.Id,
            ChildId = c.Id
        };

        db.ParentChildRelationships.AddRange(parentChildAB, parentChildBC);

        await db.SaveChangesAsync();

        var service = new RelationshipService(db);

        var dto = new CreateRelationshipDto
        {
            ParentId = c.Id,
            ChildId = a.Id
        };

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateRelationshipAsync(dto));
    }
}