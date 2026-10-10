# Run from any directory. Migration/seed are explicit operations, never automatic on startup.
[CmdletBinding()]
param(
    [switch]$Migrate,
    [switch]$SeedDemo
)

$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$project = Join-Path $repository 'src\EducationGamePlatform\EducationGamePlatform.csproj'
$arguments = @('run', '--project', $project, '--launch-profile', 'http')
if ($Migrate -or $SeedDemo) {
    $arguments += '--'
    if ($Migrate) { $arguments += '--migrate' }
    if ($SeedDemo) { $arguments += '--seed-demo' }
}
Push-Location -LiteralPath $repository
try {
    & dotnet @arguments
    if ($LASTEXITCODE -ne 0) { throw 'API command failed. See the error above.' }
}
finally { Pop-Location }
