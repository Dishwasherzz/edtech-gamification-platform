# Configure an existing PostgreSQL database without saving the password in shell history.
[CmdletBinding()]
param(
    [string]$DatabaseHost = 'localhost',
    [int]$DatabasePort = 5434,
    [string]$DatabaseName = 'EducationGamePlatform',
    [string]$DatabaseUser = 'education_game_platform_app',
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$settingsPath = Join-Path $repository 'src\EducationGamePlatform\appsettings.Local.json'
$psql = Join-Path $PostgresBin 'psql.exe'
if (-not (Test-Path -LiteralPath $psql)) { throw "psql not found: $psql. Set -PostgresBin." }
if ($DatabasePort -lt 1 -or $DatabasePort -gt 65535) { throw 'Invalid PostgreSQL port.' }

$securePassword = Read-Host "Password for PostgreSQL user $DatabaseUser (input is hidden)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$previousPassword = $env:PGPASSWORD
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:PGPASSWORD = $password
    & $psql -X -w -h $DatabaseHost -p $DatabasePort -U $DatabaseUser -d $DatabaseName -v ON_ERROR_STOP=1 -Atc 'SELECT current_database(), current_user;'
    if ($LASTEXITCODE -ne 0) { throw 'Connection failed. The previous configuration was not changed.' }

    # DbConnectionStringBuilder correctly quotes semicolons and other characters in passwords.
    $connection = [System.Data.Common.DbConnectionStringBuilder]::new()
    $connection['Host'] = $DatabaseHost
    $connection['Port'] = $DatabasePort
    $connection['Database'] = $DatabaseName
    $connection['Username'] = $DatabaseUser
    $connection['Password'] = $password
    $settings = @{ ConnectionStrings = @{ Database = $connection.get_ConnectionString() } } | ConvertTo-Json -Depth 3
    [IO.File]::WriteAllText($settingsPath, $settings + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Write-Output "Local connection saved in the ignored appsettings.Local.json for $DatabaseName on ${DatabaseHost}:$DatabasePort."
}
finally {
    $env:PGPASSWORD = $previousPassword
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $password = $null
    $securePassword.Dispose()
}
