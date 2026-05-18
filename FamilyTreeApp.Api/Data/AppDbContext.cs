using Microsoft.EntityFrameworkCore;
using FamilyTreeApp.Api.Entities;

namespace FamilyTreeApp.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<FamilyTree> FamilyTrees => Set<FamilyTree>();

    public DbSet<Person> Persons => Set<Person>();

    public DbSet<ParentChild> ParentChildRelationships => Set<ParentChild>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .Property(u => u.Email)
            .HasMaxLength(255);

        modelBuilder.Entity<User>()
            .Property(u => u.FirstName)
            .HasMaxLength(100);

        modelBuilder.Entity<User>()
            .Property(u => u.LastName)
            .HasMaxLength(100);
        
        modelBuilder.Entity<ParentChild>()
            .HasKey(pc => new { pc.ParentId, pc.ChildId });

        modelBuilder.Entity<ParentChild>()
            .HasOne(pc => pc.Parent)
            .WithMany(p => p.ParentRelationships)
            .HasForeignKey(pc => pc.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ParentChild>()
            .HasOne(pc => pc.Child)
            .WithMany(p => p.ChildRelationships)
            .HasForeignKey(pc => pc.ChildId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}