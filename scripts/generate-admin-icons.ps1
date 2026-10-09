# Render the repository's Admin SVG geometry without external image dependencies.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/web/public'))
foreach ($iconSize in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($iconSize / 100.0, $iconSize / 100.0)
    $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1d3530'))
    $gold = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#bda36a'))
    $letter = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#eee9dc'), 4)
    $letter.StartCap = $letter.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $letter.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $outer = New-Object System.Drawing.Drawing2D.GraphicsPath
    $inner = New-Object System.Drawing.Drawing2D.GraphicsPath
    try {
        $graphics.FillRectangle($background, 0, 0, 100, 100)
        $outer.AddLines([System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(50,18)), (New-Object System.Drawing.PointF(77,29)), (New-Object System.Drawing.PointF(77,49))))
        $outer.AddBezier(77,49,77,65,64,76,50,82)
        $outer.AddBezier(50,82,36,76,23,65,23,49)
        $outer.AddLine(23,49,23,29); $outer.CloseFigure()
        $graphics.FillPath($gold, $outer)
        $inner.AddLines([System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(50,29)), (New-Object System.Drawing.PointF(66,35)), (New-Object System.Drawing.PointF(66,49))))
        $inner.AddBezier(66,49,66,59,58,67,50,71)
        $inner.AddBezier(50,71,42,67,34,59,34,49)
        $inner.AddLine(34,49,34,35); $inner.CloseFigure()
        $graphics.FillPath($background, $inner)
        $graphics.DrawLines($letter, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(41,57)), (New-Object System.Drawing.PointF(50,37)), (New-Object System.Drawing.PointF(59,57))))
        $graphics.DrawLine($letter,44,51,56,51)
        $bitmap.Save((Join-Path $iconDirectory "admin-icon-$iconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $inner.Dispose(); $outer.Dispose(); $letter.Dispose(); $gold.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
