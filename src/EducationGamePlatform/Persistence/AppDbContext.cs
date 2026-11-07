using EducationGamePlatform.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EducationGamePlatform.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<PlayerProfile> PlayerProfiles => Set<PlayerProfile>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<LessonProgress> LessonProgress => Set<LessonProgress>();
    public DbSet<Assessment> Assessments => Set<Assessment>();
    public DbSet<AssessmentVersion> AssessmentVersions => Set<AssessmentVersion>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<AnswerOption> AnswerOptions => Set<AnswerOption>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<AttemptQuestion> AttemptQuestions => Set<AttemptQuestion>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();
    public DbSet<RewardGrant> RewardGrants => Set<RewardGrant>();
    public DbSet<TopicProgress> TopicProgress => Set<TopicProgress>();
    public DbSet<CourseCompletionReceipt> CourseCompletionReceipts => Set<CourseCompletionReceipt>();
    public DbSet<CrisisScenario> CrisisScenarios => Set<CrisisScenario>();
    public DbSet<AttemptChoice> AttemptChoices => Set<AttemptChoice>();
    public DbSet<CharacterSkin> CharacterSkins => Set<CharacterSkin>();
    public DbSet<Mascot> Mascots => Set<Mascot>();
    public DbSet<MascotReaction> MascotReactions => Set<MascotReaction>();
    public DbSet<UserSkin> UserSkins => Set<UserSkin>();
    public DbSet<SkinPurchase> SkinPurchases => Set<SkinPurchase>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        builder.Entity<ApplicationUser>().HasIndex(user => user.NormalizedEmail)
            .IsUnique().HasFilter("\"NormalizedEmail\" IS NOT NULL");
        builder.Entity<ApplicationUser>().Property(user => user.ConsentVersion).HasMaxLength(80);
        builder.Entity<PlayerProfile>().Property(profile => profile.NormalizedDisplayName).HasMaxLength(80);
        builder.Entity<PlayerProfile>().HasIndex(profile => profile.NormalizedDisplayName)
            .IsUnique().HasDatabaseName("UX_PlayerProfiles_NormalizedDisplayName");
        builder.Entity<PlayerProfile>().Property(profile => profile.HeroKey).HasMaxLength(32).HasDefaultValue("phase");
        builder.Entity<CourseCompletionReceipt>(receipt =>
        {
            receipt.HasKey(item => new { item.UserId, item.CourseId });
            receipt.HasOne<ApplicationUser>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
            receipt.HasOne<Course>().WithMany().HasForeignKey(item => item.CourseId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
