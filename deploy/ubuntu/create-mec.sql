-- Run on SQL Server 172.20.235.176 using an administrator in SSMS.
-- This creates the requested database only; application tables are migrated separately.
USE [master];
GO
IF DB_ID(N'MEC') IS NULL
    EXEC(N'CREATE DATABASE [MEC]');
GO
USE [MEC];
GO
SELECT DB_NAME() AS SelectedDatabase;
