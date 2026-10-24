using EducationGamePlatform.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EducationGamePlatform.Persistence.Configurations;

public sealed class CharacterSkinConfiguration : IEntityTypeConfiguration<CharacterSkin>
{
    public void Configure(EntityTypeBuilder<CharacterSkin> builder)
    {
        builder.Property(skin => skin.Key).HasMaxLength(100);
        builder.Property(skin => skin.Name).HasMaxLength(100);
        builder.Property(skin => skin.Description).HasMaxLength(2000);
        builder.Property(skin => skin.AssetKey).HasMaxLength(200);
        builder.HasIndex(skin => skin.Key).IsUnique();
        builder.ToTable("CharacterSkins", table => table.HasCheckConstraint("CK_CharacterSkin_Settings",
            "\"PriceCoins\" >= 0 AND \"SortOrder\" >= 0 AND (NOT \"IsStarter\" OR \"PriceCoins\" = 0)"));
        builder.HasData(CosmeticDefaults.Skins());
    }
}

public sealed class MascotConfiguration : IEntityTypeConfiguration<Mascot>
{
    public void Configure(EntityTypeBuilder<Mascot> builder)
    {
        builder.Property(mascot => mascot.Key).HasMaxLength(100);
        builder.Property(mascot => mascot.Name).HasMaxLength(100);
        builder.Property(mascot => mascot.Description).HasMaxLength(2000);
        builder.Property(mascot => mascot.AssetKey).HasMaxLength(200);
        builder.HasIndex(mascot => mascot.Key).IsUnique();
        builder.HasData(CosmeticDefaults.Mascots());
    }
}

public sealed class MascotReactionConfiguration : IEntityTypeConfiguration<MascotReaction>
{
    public void Configure(EntityTypeBuilder<MascotReaction> builder)
    {
        builder.Property(reaction => reaction.Event).HasConversion<string>().HasMaxLength(30);
        builder.Property(reaction => reaction.Context).HasConversion<string>().HasMaxLength(20);
        builder.Property(reaction => reaction.AssetKey).HasMaxLength(200);
        builder.Property(reaction => reaction.Message).HasMaxLength(1000);
        builder.HasOne(reaction => reaction.Mascot).WithMany(mascot => mascot.Reactions)
            .HasForeignKey(reaction => reaction.MascotId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(reaction => new { reaction.MascotId, reaction.Event, reaction.Context, reaction.Variant }).IsUnique();
        builder.ToTable("MascotReactions", table => table.HasCheckConstraint("CK_MascotReaction_Variant", "\"Variant\" >= 0"));
        builder.HasData(CosmeticDefaults.Reactions());
    }
}

public sealed class SkinPurchaseConfiguration : IEntityTypeConfiguration<SkinPurchase>
{
    public void Configure(EntityTypeBuilder<SkinPurchase> builder)
    {
        builder.HasAlternateKey(purchase => new { purchase.Id, purchase.UserId, purchase.SkinId });
        builder.HasOne(purchase => purchase.User).WithMany().HasForeignKey(purchase => purchase.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(purchase => purchase.Skin).WithMany().HasForeignKey(purchase => purchase.SkinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(purchase => new { purchase.UserId, purchase.RequestId }).IsUnique();
        builder.HasIndex(purchase => new { purchase.UserId, purchase.SkinId }).IsUnique();
        builder.ToTable("SkinPurchases", table => table.HasCheckConstraint("CK_SkinPurchase_Price", "\"PricePaid\" >= 0"));
    }
}

public sealed class UserSkinConfiguration : IEntityTypeConfiguration<UserSkin>
{
    public void Configure(EntityTypeBuilder<UserSkin> builder)
    {
        builder.HasKey(item => new { item.UserId, item.SkinId });
        builder.HasOne(item => item.User).WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(item => item.Skin).WithMany().HasForeignKey(item => item.SkinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(item => item.Purchase).WithOne()
            .HasForeignKey<UserSkin>(item => new { item.PurchaseId, item.UserId, item.SkinId })
            .HasPrincipalKey<SkinPurchase>(purchase => new { purchase.Id, purchase.UserId, purchase.SkinId }).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProfileAppearanceConfiguration : IEntityTypeConfiguration<PlayerProfile>
{
    public void Configure(EntityTypeBuilder<PlayerProfile> builder)
    {
        builder.HasOne<CharacterSkin>().WithMany().HasForeignKey(profile => profile.EquippedSkinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Mascot>().WithMany().HasForeignKey(profile => profile.SelectedMascotId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class AttemptAppearanceConfiguration : IEntityTypeConfiguration<Attempt>
{
    public void Configure(EntityTypeBuilder<Attempt> builder)
    {
        builder.HasOne<CharacterSkin>().WithMany().HasForeignKey(attempt => attempt.CharacterSkinId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Mascot>().WithMany().HasForeignKey(attempt => attempt.MascotId).OnDelete(DeleteBehavior.Restrict);
    }
}
