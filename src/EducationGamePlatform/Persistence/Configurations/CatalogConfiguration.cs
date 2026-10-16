using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EducationGamePlatform.Persistence.Configurations;

public sealed class ProfileConfiguration : IEntityTypeConfiguration<PlayerProfile>
{
    public void Configure(EntityTypeBuilder<PlayerProfile> builder)
    {
        builder.HasKey(profile => profile.UserId);
        builder.Property(profile => profile.DisplayName).HasMaxLength(80);
        builder.Property(profile => profile.AvatarKey).HasMaxLength(100);
        builder.HasOne(profile => profile.User).WithOne(user => user.Profile)
            .HasForeignKey<PlayerProfile>(profile => profile.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.ToTable("PlayerProfiles", table =>
        {
            table.HasCheckConstraint("CK_PlayerProfile_Xp", "\"TotalXp\" >= 0");
            table.HasCheckConstraint("CK_PlayerProfile_Coins", "\"CoinsBalance\" >= 0");
        });
    }
}

public sealed class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.Property(course => course.Slug).HasMaxLength(100);
        builder.HasIndex(course => course.Slug).IsUnique();
        builder.Property(course => course.Title).HasMaxLength(200);
        builder.Property(course => course.Description).HasMaxLength(2000);
    }
}

public sealed class TopicConfiguration : IEntityTypeConfiguration<Topic>
{
    public void Configure(EntityTypeBuilder<Topic> builder)
    {
        builder.Property(topic => topic.Title).HasMaxLength(200);
        builder.Property(topic => topic.Description).HasMaxLength(2000);
        builder.HasOne(topic => topic.Course).WithMany(course => course.Topics)
            .HasForeignKey(topic => topic.CourseId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(topic => new { topic.CourseId, topic.SortOrder });
        builder.ToTable("Topics", table => table.HasCheckConstraint("CK_Topic_Order", "\"SortOrder\" >= 0"));
    }
}

public sealed class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> builder)
    {
        builder.Property(lesson => lesson.Title).HasMaxLength(200);
        builder.HasOne(lesson => lesson.Topic).WithMany(topic => topic.Lessons)
            .HasForeignKey(lesson => lesson.TopicId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(lesson => new { lesson.TopicId, lesson.SortOrder });
        builder.ToTable("Lessons", table => table.HasCheckConstraint("CK_Lesson_Order", "\"SortOrder\" >= 0"));
    }
}

public sealed class LessonProgressConfiguration : IEntityTypeConfiguration<LessonProgress>
{
    public void Configure(EntityTypeBuilder<LessonProgress> builder)
    {
        builder.HasKey(progress => new { progress.UserId, progress.LessonId });
        builder.ToTable("LessonProgress", table => table.HasCheckConstraint("CK_LessonProgress_AwardedXp", "\"AwardedXp\" >= 0"));
        builder.HasOne(progress => progress.User).WithMany().HasForeignKey(progress => progress.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(progress => progress.Lesson).WithMany().HasForeignKey(progress => progress.LessonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
