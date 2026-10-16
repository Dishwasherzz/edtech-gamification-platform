using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EducationGamePlatform.Persistence.Configurations;

public sealed class TopicProgressConfiguration : IEntityTypeConfiguration<TopicProgress>
{
    public void Configure(EntityTypeBuilder<TopicProgress> builder)
    {
        builder.HasKey(progress => new { progress.UserId, progress.TopicId });
        builder.HasOne(progress => progress.User).WithMany().HasForeignKey(progress => progress.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(progress => progress.Topic).WithMany().HasForeignKey(progress => progress.TopicId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(progress => progress.FirstAttempt).WithMany()
            .HasForeignKey(progress => new { progress.FirstAttemptId, progress.UserId, progress.TopicId })
            .HasPrincipalKey(attempt => new { attempt.Id, attempt.UserId, attempt.TopicId }).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CrisisScenarioConfiguration : IEntityTypeConfiguration<CrisisScenario>
{
    public void Configure(EntityTypeBuilder<CrisisScenario> builder)
    {
        builder.HasAlternateKey(scenario => new { scenario.Id, scenario.AssessmentVersionId });
        builder.Property(scenario => scenario.Title).HasMaxLength(200);
        builder.Property(scenario => scenario.Introduction).HasMaxLength(4000);
        builder.Property(scenario => scenario.IllustrationKey).HasMaxLength(40);
        builder.HasOne(scenario => scenario.AssessmentVersion).WithMany(version => version.Scenarios)
            .HasForeignKey(scenario => scenario.AssessmentVersionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(scenario => new { scenario.AssessmentVersionId, scenario.SortOrder }).IsUnique();
    }
}

public sealed class QuestionScenarioConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder) => builder.HasOne(question => question.Scenario)
        .WithMany(scenario => scenario.Questions)
        .HasForeignKey(question => new { question.ScenarioId, question.AssessmentVersionId })
        .HasPrincipalKey(scenario => new { scenario.Id, scenario.AssessmentVersionId }).OnDelete(DeleteBehavior.Restrict);
}

public sealed class AttemptChoiceConfiguration : IEntityTypeConfiguration<AttemptChoice>
{
    public void Configure(EntityTypeBuilder<AttemptChoice> builder)
    {
        builder.HasOne(choice => choice.AttemptQuestion).WithMany()
            .HasForeignKey(choice => new { choice.AttemptQuestionId, choice.AttemptId, choice.QuestionId })
            .HasPrincipalKey(question => new { question.Id, question.AttemptId, question.QuestionId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(choice => choice.SelectedOption).WithMany()
            .HasForeignKey(choice => new { choice.SelectedOptionId, choice.QuestionId })
            .HasPrincipalKey(option => new { option.Id, option.QuestionId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(choice => new { choice.AttemptId, choice.RequestId }).IsUnique();
        builder.HasIndex(choice => new { choice.AttemptQuestionId, choice.SelectedOptionId }).IsUnique();
    }
}
