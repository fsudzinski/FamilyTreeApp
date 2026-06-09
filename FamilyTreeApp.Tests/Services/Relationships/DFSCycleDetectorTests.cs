using FamilyTreeApp.Api.Services.Relationships;

namespace FamilyTreeApp.Tests.Services.Relationships;

public class DFSCycleDetectorTests
{
    [Fact]
    public void HasCycle_ReturnsFalse_ForSimpleTree()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();
        var d = Guid.NewGuid();
        
        var relationships = new List<(Guid ParentId, Guid ChildId)>
        {
            (a, b),
            (b, c),
            (c, d)
        };

        var detector = new DFSCycleDetector(relationships);

        var result = detector.HasCycle();

        Assert.False(result);
    }

    [Fact]
    public void HasCycle_ReturnsTrue_WhenCycleExists()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();

        var relationships = new List<(Guid ParentId, Guid ChildId)>
        {
            (a, b),
            (b, c),
            (c, a)
        };

        var detector = new DFSCycleDetector(relationships);

        var result = detector.HasCycle();

        Assert.True(result);
    }
}