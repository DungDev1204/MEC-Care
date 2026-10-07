using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClientStudio.Api.Migrations
{
    /// <inheritdoc />
    public partial class WebPushSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AuthKey",
                table: "Devices",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Endpoint",
                table: "Devices",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "P256dh",
                table: "Devices",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SessionId",
                table: "Devices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Devices_SessionId",
                table: "Devices",
                column: "SessionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Sessions_SessionId",
                table: "Devices",
                column: "SessionId",
                principalTable: "Sessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Sessions_SessionId",
                table: "Devices");

            migrationBuilder.DropIndex(
                name: "IX_Devices_SessionId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "AuthKey",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "Endpoint",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "P256dh",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "Devices");
        }
    }
}
