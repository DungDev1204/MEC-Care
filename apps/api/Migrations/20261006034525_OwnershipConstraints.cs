using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClientStudio.Api.Migrations
{
    /// <inheritdoc />
    public partial class OwnershipConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Sessions_EmployeeId",
                table: "Sessions",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_Devices_OwnerId",
                table: "Devices",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_OccurrenceId",
                table: "Contacts",
                column: "OccurrenceId");

            migrationBuilder.AddForeignKey(
                name: "FK_Contacts_Occurrences_OccurrenceId",
                table: "Contacts",
                column: "OccurrenceId",
                principalTable: "Occurrences",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Customers_Employees_OwnerId",
                table: "Customers",
                column: "OwnerId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Employees_OwnerId",
                table: "Devices",
                column: "OwnerId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sessions_Employees_EmployeeId",
                table: "Sessions",
                column: "EmployeeId",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Contacts_Occurrences_OccurrenceId",
                table: "Contacts");

            migrationBuilder.DropForeignKey(
                name: "FK_Customers_Employees_OwnerId",
                table: "Customers");

            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Employees_OwnerId",
                table: "Devices");

            migrationBuilder.DropForeignKey(
                name: "FK_Sessions_Employees_EmployeeId",
                table: "Sessions");

            migrationBuilder.DropIndex(
                name: "IX_Sessions_EmployeeId",
                table: "Sessions");

            migrationBuilder.DropIndex(
                name: "IX_Devices_OwnerId",
                table: "Devices");

            migrationBuilder.DropIndex(
                name: "IX_Contacts_OccurrenceId",
                table: "Contacts");
        }
    }
}
