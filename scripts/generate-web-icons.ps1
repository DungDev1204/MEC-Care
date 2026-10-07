$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$webIconRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'apps/web/public'
foreach ($webIconSize in 192, 512) {
    $webIconCanvas = New-Object System.Drawing.Bitmap($webIconSize, $webIconSize)
    $webIconGraphics = [System.Drawing.Graphics]::FromImage($webIconCanvas)
    $webIconPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#eee9dc'), ($webIconSize * 0.025))
    try {
        $webIconGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#1d3530'))
        $webIconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $webIconGraphics.DrawArc($webIconPen, [single]($webIconSize * .24), [single]($webIconSize * .22), [single]($webIconSize * .49), [single]($webIconSize * .56), 45, 270)
        $webIconGraphics.DrawArc($webIconPen, [single]($webIconSize * .32), [single]($webIconSize * .3), [single]($webIconSize * .34), [single]($webIconSize * .4), 45, 270)
        $webIconGraphics.DrawLine($webIconPen, [single]($webIconSize * .58), [single]($webIconSize * .16), [single]($webIconSize * .69), [single]($webIconSize * .12))
        $webIconCanvas.Save((Join-Path $webIconRoot "icon-$webIconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $webIconPen.Dispose(); $webIconGraphics.Dispose(); $webIconCanvas.Dispose() }
}
