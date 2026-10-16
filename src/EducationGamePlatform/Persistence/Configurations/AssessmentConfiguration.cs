using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EducationGamePlatform.Persistence.Configurations;

public sealed class AssessmentConfiguration : IEntityTypeConfiguration<Assessment>
{
    public void Configure(EntityTypeBuilder<Assessment> builder)
    {
        builder.HasAlternateKey(assessment => new { assessment.Id, assessment.TopicId });
        builder.Property(assessment => assessment.Title).HasMaxLength(200);
        builder.Property(assessment => assessment.Mode).HasConversion<string>().HasMaxLength(20);
        builder.HasOne(assessment => assessment.Topic).WithMany(topic => topic.Assessments)
            .HasForeignKey(assessment => assessment.TopicId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class AssessmentVersionConfiguration : IEntityTypeConfiguration<AssessmentVersion>
{
    public void Configure(EntityTypeBuilder<AssessmentVersion> builder)
    {
        builder.HasAlternateKey(version => new { version.Id, version.AssessmentId });
        builder.HasIndex(version => new { version.AssessmentId, version.VersionNumber }).IsUnique();
        builder.Property(version => version.BossName).HasMaxLength(100);
        builder.HasOne(version => version.Assessment).WithMany(assessment => assessment.Versions)
            .HasForeignKey(version => version.AssessmentId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("AssessmentVersions", table => table.HasCheckConstraint("CK_AssessmentVersion_Settings",
            "\"VersionNumber\" > 0 AND \"QuestionTimeLimitSeconds\" > 0 AND \"RequiredCorrectAnswers\" > 0 " +
            "AND \"XpReward\" >= 0 AND \"CoinsReward\" >= 0 AND \"BossMaxHp\" >= 0 AND \"DamagePerCorrectAnswer\" >= 0"));
    }
}

public sealed class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.HasAlternateKey(question => new { question.Id, question.AssessmentVersionId });
        builder.Property(question => question.Type).HasConversion<string>().HasMaxLength(30);
        builder.Property(question => question.Prompt).HasMaxLength(4000);
        builder.Property(question => question.Explanation).HasMaxLength(4000);
        builder.HasOne(question => question.AssessmentVersion).WithMany(version => version.Questions)
            .HasForeignKey(question => question.AssessmentVersionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(question => new { question.AssessmentVersionId, question.SortOrder }).IsUnique();
    }
}

public sealed class AnswerOptionConfiguration : IEntityTypeConfiguration<AnswerOption>
{
    public void Configure(EntityTypeBuilder<AnswerOption> builder)
    {
        builder.HasAlternateKey(option => new { option.Id, option.QuestionId });
        builder.Property(option => option.Text).HasMaxLength(2000);
        builder.HasOne(option => option.Question).WithMany(question => question.Options)
            .HasForeignKey(option => option.QuestionId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(option => new { option.QuestionId, option.SortOrder }).IsUnique();
        // Publication must additionally verify that a correct option exists.
        builder.HasIndex(option => option.QuestionId).IsUnique().HasFilter("\"IsCorrect\" = TRUE");
    }
}
