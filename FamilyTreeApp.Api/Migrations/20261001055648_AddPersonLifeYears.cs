using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamilyTreeApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonLifeYears : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BirthYear",
                table: "Persons",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeathYear",
                table: "Persons",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BirthYear",
                table: "Persons");

            migrationBuilder.DropColumn(
                name: "DeathYear",
                table: "Persons");
        }
    }
}
