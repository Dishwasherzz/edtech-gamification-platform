using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EducationGamePlatform.Persistence.Configurations;

public sealed class AttemptConfiguration : IEntityTypeConfiguration<Attempt>
{
    public void Configure(EntityTypeBuilder<Attempt> builder)
    {
        builder.HasAlternateKey(attempt => new { attempt.Id, attempt.AssessmentVersionId });
        builder.HasAlternateKey(attempt => new { attempt.Id, attempt.UserId, attempt.AssessmentId });
        builder.HasAlternateKey(attempt => new { attempt.Id, attempt.UserId, attempt.TopicId });
        builder.Property(attempt => attempt.FinishReason).HasMaxLength(40);
        builder.HasOne(attempt => attempt.Topic).WithMany().HasForeignKey(attempt => attempt.TopicId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Assessment>().WithMany().HasForeignKey(attempt => new { attempt.AssessmentId, attempt.TopicId })
            .HasPrincipalKey(assessment => new { assessment.Id, assessment.TopicId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(attempt => attempt.Scenario).WithMany()
            .HasForeignKey(attempt => new { attempt.ScenarioId, attempt.AssessmentVersionId })
            .HasPrincipalKey(scenario => new { scenario.Id, scenario.AssessmentVersionId }).OnDelete(DeleteBehavior.Restrict);
        builder.Property(attempt => attempt.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne(attempt => attempt.User).WithMany().HasForeignKey(attempt => attempt.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(attempt => attempt.AssessmentVersion).WithMany()
            .HasForeignKey(attempt => new { attempt.AssessmentVersionId, attempt.AssessmentId })
            .HasPrincipalKey(version => new { version.Id, version.AssessmentId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(attempt => new { attempt.UserId, attempt.StartedAt });
        builder.HasIndex(attempt => new { attempt.UserId, attempt.AssessmentId }).IsUnique()
            .HasFilter("\"Status\" = 'Active'");
        builder.HasIndex(attempt => attempt.UserId).IsUnique().HasFilter("\"Status\" = 'Active'");
        builder.HasIndex(attempt => new { attempt.Status, attempt.ExpiresAt });
        builder.ToTable("Attempts", table => table.HasCheckConstraint("CK_Attempt_Counts",
            "\"QuestionCount\" > 0 AND \"CorrectAnswers\" >= 0 AND \"CorrectAnswers\" <= \"QuestionCount\" AND \"BossHpRemaining\" >= 0 AND \"ErrorCount\" >= 0"));
    }
}

public sealed class AttemptQuestionConfiguration : IEntityTypeConfiguration<AttemptQuestion>
{
    public void Configure(EntityTypeBuilder<AttemptQuestion> builder)
    {
        builder.HasAlternateKey(question => new { question.Id, question.QuestionId });
        builder.HasAlternateKey(question => new { question.Id, question.AttemptId, question.QuestionId });
        builder.Property(question => question.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne(question => question.Attempt).WithMany(attempt => attempt.Questions)
            .HasForeignKey(question => new { question.AttemptId, question.AssessmentVersionId })
            .HasPrincipalKey(attempt => new { attempt.Id, attempt.AssessmentVersionId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(question => question.Question).WithMany()
            .HasForeignKey(question => new { question.QuestionId, question.AssessmentVersionId })
            .HasPrincipalKey(question => new { question.Id, question.AssessmentVersionId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(question => new { question.AttemptId, question.Position }).IsUnique();
        builder.HasIndex(question => new { question.AttemptId, question.QuestionId }).IsUnique();
        builder.ToTable("AttemptQuestions", table => table.HasCheckConstraint("CK_AttemptQuestion_Deadline",
            "\"Position\" >= 0 AND ((\"PresentedAt\" IS NULL AND \"ExpiresAt\" IS NULL) OR " +
            "(\"PresentedAt\" IS NOT NULL AND \"ExpiresAt\" IS NOT NULL AND \"ExpiresAt\" > \"PresentedAt\"))"));
    }
}

public sealed class AttemptAnswerConfiguration : IEntityTypeConfiguration<AttemptAnswer>
{
    public void Configure(EntityTypeBuilder<AttemptAnswer> builder)
    {
        builder.HasKey(answer => answer.AttemptQuestionId);
        builder.HasOne(answer => answer.AttemptQuestion).WithOne(question => question.Answer)
            .HasForeignKey<AttemptAnswer>(answer => new { answer.AttemptQuestionId, answer.QuestionId })
            .HasPrincipalKey<AttemptQuestion>(question => new { question.Id, question.QuestionId })
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(answer => answer.SelectedOption).WithMany()
            .HasForeignKey(answer => new { answer.SelectedOptionId, answer.QuestionId })
            .HasPrincipalKey(option => new { option.Id, option.QuestionId }).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class RewardGrantConfiguration : IEntityTypeConfiguration<RewardGrant>
{
    public void Configure(EntityTypeBuilder<RewardGrant> builder)
    {
        builder.Property(reward => reward.Reason).HasConversion<string>().HasMaxLength(30);
        builder.HasOne(reward => reward.Attempt).WithOne()
            .HasForeignKey<RewardGrant>(reward => new { reward.AttemptId, reward.UserId, reward.AssessmentId })
            .HasPrincipalKey<Attempt>(attempt => new { attempt.Id, attempt.UserId, attempt.AssessmentId })
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(reward => reward.User).WithMany().HasForeignKey(reward => reward.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Attempt>().WithMany()
            .HasForeignKey(reward => new { reward.AttemptId, reward.UserId, reward.TopicId })
            .HasPrincipalKey(attempt => new { attempt.Id, attempt.UserId, attempt.TopicId }).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(reward => reward.AttemptId).IsUnique();
        builder.HasIndex(reward => new { reward.UserId, reward.TopicId }).IsUnique()
            .HasFilter("\"Reason\" = 'FirstPass'");
        builder.ToTable("RewardGrants", table => table.HasCheckConstraint("CK_RewardGrant_Amounts",
            "\"XpAmount\" >= 0 AND \"CoinsAmount\" >= 0"));
    }
}
