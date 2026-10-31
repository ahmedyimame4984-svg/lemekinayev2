param([Parameter(Mandatory=$true)][ValidateSet('lemekinaye_ev_stage02_fresh_utf8','lemekinaye_ev_stage02_upgrade_utf8')][string]$Database, [switch]$BeforeStage2)
$ErrorActionPreference='Stop'
$evRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evMigrationsRoot=Join-Path $evRoot 'packages/database/prisma/migrations'
$evDirectories=@(Get-ChildItem -LiteralPath $evMigrationsRoot -Directory | Sort-Object Name | Where-Object { !$BeforeStage2 -or $_.Name -ne '20261015210000_vehicle_ev_technical_contract' } | ForEach-Object {
  @{path=$_.Name;migrationFile=@{path='migration.sql';content=@{tag='ok';value=[IO.File]::ReadAllText((Join-Path $_.FullName 'migration.sql'))}}}
})
# Same migration list format and applyMigrations RPC used by the installed Prisma 7.10 CLI.
# Launch the engine directly because this host blocks Node child-process creation.
$evRequest=@{id=1;jsonrpc='2.0';method='applyMigrations';params=@{migrationsList=@{baseDir=$evMigrationsRoot;lockfile=@{path='migration_lock.toml';content=[IO.File]::ReadAllText((Join-Path $evMigrationsRoot 'migration_lock.toml'))};migrationDirectories=$evDirectories;shadowDbInitScript=''};filters=@{externalTables=@();externalEnums=@()}}} | ConvertTo-Json -Compress -Depth 15
$evDatasource=@{url="postgresql://ev_stage2@127.0.0.1:55442/$Database"} | ConvertTo-Json -Compress
$evStart=[Diagnostics.ProcessStartInfo]::new()
$evStart.FileName=Join-Path $evRoot 'node_modules/@prisma/engines/schema-engine-windows.exe'
$evStart.UseShellExecute=$false
$evStart.CreateNoWindow=$true
$evStart.RedirectStandardInput=$true
$evStart.RedirectStandardOutput=$true
$evStart.RedirectStandardError=$true
$evStart.StandardInputEncoding=[Text.UTF8Encoding]::new($false)
$evStart.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
$evStart.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
$evStart.ArgumentList.Add('--datamodels')
$evStart.ArgumentList.Add((Join-Path $evRoot 'packages/database/prisma/schema.prisma'))
$evStart.ArgumentList.Add('--datasource')
$evStart.ArgumentList.Add($evDatasource)
$evProcess=[Diagnostics.Process]::new()
$evProcess.StartInfo=$evStart
try {
  if (!$evProcess.Start()) { throw 'Unable to start Prisma engine.' }
  $evErrors=$evProcess.StandardError.ReadToEndAsync()
  $evProcess.StandardInput.WriteLine($evRequest)
  while ($true) {
    $evLine=$evProcess.StandardOutput.ReadLine()
    if ($null -eq $evLine) { throw 'Engine closed before responding.' }
    $evResponse=$evLine | ConvertFrom-Json
    if ($evResponse.method -eq 'print') {
      Write-Output $evResponse.params.content
      $evProcess.StandardInput.WriteLine((@{jsonrpc='2.0';id=$evResponse.id;result=@{}} | ConvertTo-Json -Compress))
      continue
    }
    if ($evResponse.id -eq 1) {
      if ($evResponse.error) { throw ($evResponse.error | ConvertTo-Json -Depth 8 -Compress) }
      Write-Output ($evResponse.result | ConvertTo-Json -Depth 8 -Compress)
      break
    }
    throw 'Unexpected engine message.'
  }
} finally {
  if ($evProcess.Id -and !$evProcess.HasExited) { $evProcess.StandardInput.Close(); if (!$evProcess.WaitForExit(3000)) { $evProcess.Kill() } }
  $evProcess.Dispose()
}
