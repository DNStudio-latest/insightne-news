# Weekly database backup from this PC to Google Drive (backup option 1).
# Makes one locked backup file (see scripts/backup-db.js), copies it to Drive, checks the copy, deletes the local file,
# and keeps only the newest 8 backups on Drive. The passphrase is read from a file outside the project and never printed.
# Run by the Windows scheduled task "InsightNE weekly database backup" (made by scripts/install-backup-task.ps1).
$ErrorActionPreference = 'Stop'
$repo      = 'C:\Users\debna\insightne-news'
$keyDir    = 'C:\Users\debna\InsightNE-backup-keys'
$passFile  = Join-Path $keyDir 'backup-passphrase.txt'
$logFile   = Join-Path $keyDir 'backup-log.txt'
$rclone    = 'C:\Users\debna\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\rclone-v1.75.1-windows-amd64\rclone.exe'
$remote    = 'gdrive:my-video-uploads/insightne-db-backups'
$keepNewest = 8
$tmp       = Join-Path $env:TEMP 'insightne-db-backup'

function Log($msg) { Add-Content -Path $logFile -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $msg) }

try {
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Set-Location $repo
  $out = & node --env-file=.env.local scripts/backup-db.js --out $tmp --passphrase-file $passFile 2>&1
  if ($LASTEXITCODE -ne 0) { throw "backup-db.js failed: $($out | Select-Object -Last 2)" }
  $file = Get-ChildItem $tmp -Filter 'insightne-db-*.json.gz.enc' | Select-Object -First 1
  if (-not $file) { throw 'no backup file was made' }

  & $rclone copy $file.FullName $remote --quiet
  if ($LASTEXITCODE -ne 0) { throw 'rclone copy to Google Drive failed' }
  # The copy on Drive must have the same size as the local file.
  $remoteSize = (& $rclone lsjson $remote --files-only | ConvertFrom-Json | Where-Object { $_.Name -eq $file.Name }).Size
  if ($remoteSize -ne $file.Length) { throw "Drive copy size differs ($remoteSize, expected $($file.Length))" }

  # Keep only the newest backups on Drive (the date is in the file name).
  $all = & $rclone lsf $remote --files-only | Where-Object { $_ -like 'insightne-db-*.json.gz.enc' } | Sort-Object -Descending
  foreach ($old in ($all | Select-Object -Skip $keepNewest)) { & $rclone deletefile "$remote/$old" --quiet; Log "removed old backup $old" }

  Log ("OK  {0}  {1:N2} MB  (kept on Drive: {2})" -f $file.Name, ($file.Length / 1MB), [Math]::Min($all.Count, $keepNewest))
  Remove-Item -Recurse -Force $tmp
} catch {
  Log ("FAILED  " + $_.Exception.Message)
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  exit 1
}
