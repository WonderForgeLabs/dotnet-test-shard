namespace ShardingTests;

/// <summary>
/// Integration tests that verify various test scenarios work with sharding.
/// These tests ensure the action can handle different test patterns.
/// </summary>
public class IntegrationTests
{
    /// <summary>
    /// Tests with special characters in names should be handled correctly.
    /// </summary>
    [Fact]
    public void Test_With_Underscores_In_Name()
    {
        Assert.True(true);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Theory_With_Multiple_Cases(int value)
    {
        Assert.True(value > 0);
    }

    [Fact]
    public void Test_That_Takes_Some_Time()
    {
        // Simulate a test that takes some time
        Thread.Sleep(50);
        Assert.True(true);
    }
}

/// <summary>
/// Tests organized by feature area to simulate real-world test organization.
/// </summary>
public class FeatureATests
{
    [Fact]
    public void Feature_A_Scenario_1() => Assert.True(true);

    [Fact]
    public void Feature_A_Scenario_2() => Assert.True(true);

    [Fact]
    public void Feature_A_Edge_Case() => Assert.True(true);
}

public class FeatureBTests
{
    [Fact]
    public void Feature_B_Scenario_1() => Assert.True(true);

    [Fact]
    public void Feature_B_Scenario_2() => Assert.True(true);

    [Fact]
    public void Feature_B_Edge_Case() => Assert.True(true);
}

/// <summary>
/// Trait-based tests to verify filtering works with sharding.
/// </summary>
public class TraitTests
{
    [Fact]
    [Trait("Category", "Unit")]
    public void Unit_Test_1() => Assert.True(true);

    [Fact]
    [Trait("Category", "Unit")]
    public void Unit_Test_2() => Assert.True(true);

    [Fact]
    [Trait("Category", "Integration")]
    public void Integration_Test_1() => Assert.True(true);

    [Fact]
    [Trait("Category", "Integration")]
    public void Integration_Test_2() => Assert.True(true);
}
