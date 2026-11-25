# Makes (or replaces) the Windows scheduled task for the weekly database backup. Runs every Sunday at 10:00; if the
# computer was off at that time, it runs as soon as the computer is on again. No administrator rights needed.
$taskName = 'InsightNE weekly database backup'
$script   = 'C:\Users\debna\insightne-news\scripts\backup-to-drive.ps1'
$action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 10:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Exports the InsightNE database, locks it, copies it to Google Drive, keeps the newest 8.' -Force | Out-Null
"Task '$taskName' is set: every Sunday 10:00, or at the next start if the PC was off."
