# Windows asset renderer. Run from any directory after editing brand-mark.json.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps/mobile/assets'
$mark = Get-Content -LiteralPath (Join-Path $assetDirectory 'brand-mark.json') -Raw | ConvertFrom-Json

function Write-MarkPng {
    param([string]$Name, [int]$Size, [double]$Scale, [string]$Background, [string]$Foreground)
    $sampleSize = $Size * 4
    $canvas = New-Object System.Drawing.Bitmap($sampleSize, $sampleSize)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($Foreground))
    $pixelFormat = if ($Background) { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb } else { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb }
    $output = New-Object System.Drawing.Bitmap($Size, $Size, $pixelFormat)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    try {
        $clearColor = if ($Background) { [System.Drawing.ColorTranslator]::FromHtml($Background) } else { [System.Drawing.Color]::Transparent }
        $graphics.Clear($clearColor)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        if ($Scale -gt 0) {
            foreach ($polygon in $mark.polygons) {
                [System.Drawing.PointF[]]$points = foreach ($point in $polygon) {
                    $x = (50 + ($point[0] - 50) * $Scale) * $sampleSize / 100
                    $y = (50 + ($point[1] - 50) * $Scale) * $sampleSize / 100
                    New-Object System.Drawing.PointF([single]$x, [single]$y)
                }
                $graphics.FillPolygon($brush, $points)
            }
        }
        $outputGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $outputGraphics.DrawImage($canvas, 0, 0, $Size, $Size)
        $output.Save((Join-Path $assetDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $outputGraphics.Dispose(); $output.Dispose(); $brush.Dispose(); $graphics.Dispose(); $canvas.Dispose()
    }
}

Write-MarkPng 'icon.png' 1024 0.86 $mark.background $mark.foreground
# Adaptive layers keep the entire accented letter inside the central safe area.
Write-MarkPng 'android-icon-foreground.png' 1024 0.70 '' $mark.foreground
Write-MarkPng 'android-icon-monochrome.png' 1024 0.70 '' '#FFFFFF'
Write-MarkPng 'android-icon-background.png' 1024 0 $mark.background $mark.foreground
Write-MarkPng 'favicon.png' 64 0.86 $mark.background $mark.foreground
Write-MarkPng 'splash-icon.png' 512 0.86 '' $mark.background

$polygons = ($mark.polygons | ForEach-Object {
    $points = ($_ | ForEach-Object { $_ -join ',' }) -join ' '
    '<polygon points="' + $points + '" fill="' + $mark.foreground + '" />'
}) -join ''
$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Client&#233; - &#201;</title><rect width="100" height="100" fill="' + $mark.background + '" /><g transform="translate(7 7) scale(0.86)">' + $polygons + '</g></svg>'
[System.IO.File]::WriteAllText((Join-Path $assetDirectory 'logo.svg'), $svg, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'Generated Cliente launcher, adaptive, favicon, splash and SVG assets.'
