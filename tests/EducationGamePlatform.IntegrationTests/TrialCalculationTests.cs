using System.Globalization;
using System.Numerics;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EducationGamePlatform.IntegrationTests;

public sealed class TrialCalculationTests
{
    public static IEnumerable<object[]> ScalarAnswers()
    {
        yield return ["T6-B01", 1 / Math.Sqrt(.01 * 10e-6), 1d];
        yield return ["T6-B02", 1 / (2 * Math.PI * Math.Sqrt(.0253 * 1e-6)), 1d];
        yield return ["T6-B03", Math.Sqrt(.1 / 10e-6), .01d];
        yield return ["T6-B04", 100d / 5, .01d];
        yield return ["T6-B05", 10d / 5 * 100, .01d];
        yield return ["T6-B06", 50d / 10, .01d];
        yield return ["T6-B07", 1000d / 20, .01d];
        yield return ["T6-B08", 1 / (Math.Pow(2 * Math.PI * 50, 2) * 20e-6), .001d];
        yield return ["T6-B10", Math.Sqrt((10000d - 3600) / (10000 - 6400)), .005d];
        yield return ["T6-B12", 80 * (Math.Tan(Math.Acos(.8)) - Math.Tan(Math.Acos(.96))), .05d];
        yield return ["T6-B13", 10000 / (2 * Math.PI * 50 * 220 * 220) * 1e6, 1d];
        yield return ["T6-B14", Math.Pow(1 / .5, 2), .01d];
        yield return ["T7-B01", (120d - 40) / 4, .01d];
        yield return ["T7-B02", .16 / Math.Sqrt(.1 * .4), .001d];
        yield return ["T7-B03", 50d + 30 + 2 * 20, .01d];
        yield return ["T7-B04", .2 + .3 - 2 * .1, .001d];
        yield return ["T7-B05", 2 * Math.PI * 50 * .03183, .01d];
        yield return ["T7-B06", 100d * .1 * 2 - 100 * .05 * 1, .01d];
        yield return ["T7-B07", Complex.Abs(new Complex(2 + 4, 5 + 3)), .01d];
        yield return ["T7-B10", 100 / Complex.Abs(new Complex(6, 8)), .01d];
        yield return ["T7-B11", 8d * 5 / 10, .01d];
        yield return ["T7-B13", 10d * 10 * 6, .01d];
        yield return ["T7-B14", (100 / new Complex(6, -8)).Imaginary, .01d];
    }

    [Theory]
    [MemberData(nameof(ScalarAnswers))]
    public void SelectedAnswerMatchesCalculation(string sourceId, double calculated, double tolerance)
    {
        var answer = CorrectAnswer(sourceId);
        var number = Regex.Match(answer, @"\d+(?:[,.]\d+)?").Value.Replace(',', '.');
        Assert.InRange(Math.Abs(double.Parse(number, CultureInfo.InvariantCulture) - calculated), 0, tolerance);
    }

    [Fact]
    public void BoundaryAndComplexAnswersMatchCircuitEquations()
    {
        Assert.True((100d - 25) / (100 - 400) < 0);
        Assert.StartsWith("Нет", CorrectAnswer("T6-B09"));
        Assert.Contains("I_L = 2 А, I_вх = 0", CorrectAnswer("T6-B11"));
        Assert.Equal(2, 100d / 50);
        var reflected = 100 / new Complex(6, 8);
        Assert.Equal(new Complex(6, -8), reflected);
        Assert.Equal(new Complex(10, 4), new Complex(4, 12) + reflected);
        Assert.StartsWith("6 − j8", CorrectAnswer("T7-B08"));
        Assert.StartsWith("10 + j4", CorrectAnswer("T7-B09"));
        Assert.StartsWith("j15", CorrectAnswer("T7-B06"));
        Assert.StartsWith("+8", CorrectAnswer("T7-B14"));
        Assert.StartsWith("Больше", CorrectAnswer("T6-B10"));
        Assert.StartsWith($"{80 - 30} мГн, {50 - 30} мГн, +30 мГн", CorrectAnswer("T7-B12"));
        // Equal nonzero branch losses also yield the Thomson frequency; the degenerate rho case is separate.
        Assert.Equal(1, Math.Sqrt((10000d - 3600) / (10000 - 3600)));
    }

    private static string CorrectAnswer(string sourceId)
    {
        using var stream = typeof(Program).Assembly.GetManifestResourceStream("AdditionalTrials.json")!;
        using var document = JsonDocument.Parse(stream);
        var question = document.RootElement.GetProperty("topics").EnumerateArray()
            .SelectMany(topic => topic.GetProperty("boss").EnumerateArray())
            .Single(item => item.GetProperty("sourceId").GetString() == sourceId);
        return question.GetProperty("options")[question.GetProperty("correctIndex").GetInt32()].GetString()!;
    }
}
