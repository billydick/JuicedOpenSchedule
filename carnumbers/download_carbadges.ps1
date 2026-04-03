# Download NASCAR car badge images 0-100
# Saves to the directory the script is run from

$baseUrl = "https://cf.nascar.com/data/images/carbadges/1"
$outputDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Downloading car badges to: $outputDir"

for ($i = 0; $i -le 100; $i++) {
    $url = "$baseUrl/$i.png"
    $outFile = Join-Path $outputDir "$i.png"

    try {
        Invoke-WebRequest -Uri $url -OutFile $outFile -ErrorAction Stop
        Write-Host "Downloaded: $i.png"
    } catch {
        Write-Host "Skipped: $i (not found)"
        # Clean up empty file if created
        if (Test-Path $outFile) { Remove-Item $outFile }
    }
}

Write-Host "Done."
