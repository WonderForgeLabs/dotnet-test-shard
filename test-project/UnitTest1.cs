namespace ShardingTests;

/// <summary>
/// Test class Alpha - tests A01-A05 should be distributed across shards.
/// With 20 tests and 4 shards:
/// - Shard 1: A01, A05, B04, C03, D02
/// - Shard 2: A02, B01, B05, C04, D03
/// - Shard 3: A03, B02, C01, C05, D04
/// - Shard 4: A04, B03, C02, D01, D05
/// </summary>
public class AlphaTests
{
    [Fact]
    public void A01_FirstTest()
    {
        // Test index 0 → Shard 1
        Assert.True(true);
    }

    [Fact]
    public void A02_SecondTest()
    {
        // Test index 1 → Shard 2
        Assert.True(true);
    }

    [Fact]
    public void A03_ThirdTest()
    {
        // Test index 2 → Shard 3
        Assert.True(true);
    }

    [Fact]
    public void A04_FourthTest()
    {
        // Test index 3 → Shard 4
        Assert.True(true);
    }

    [Fact]
    public void A05_FifthTest()
    {
        // Test index 4 → Shard 1
        Assert.True(true);
    }
}

public class BetaTests
{
    [Fact]
    public void B01_FirstTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void B02_SecondTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void B03_ThirdTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void B04_FourthTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void B05_FifthTest()
    {
        Assert.True(true);
    }
}

public class GammaTests
{
    [Fact]
    public void C01_FirstTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void C02_SecondTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void C03_ThirdTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void C04_FourthTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void C05_FifthTest()
    {
        Assert.True(true);
    }
}

public class DeltaTests
{
    [Fact]
    public void D01_FirstTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void D02_SecondTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void D03_ThirdTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void D04_FourthTest()
    {
        Assert.True(true);
    }

    [Fact]
    public void D05_FifthTest()
    {
        Assert.True(true);
    }
}

/// <summary>
/// Add some failing tests to verify failure detection
/// </summary>
public class FailingTests
{
    [Fact]
    public void E01_PassingTest()
    {
        Assert.True(true);
    }

    [Fact(Skip = "Skipped for testing skip detection")]
    public void E02_SkippedTest()
    {
        Assert.True(true);
    }
}
