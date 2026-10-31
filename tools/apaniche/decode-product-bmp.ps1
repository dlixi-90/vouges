param([Parameter(Mandatory=$true)][string]$InputPath, [Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$articleBitmap = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $InputPath).Path)
try {
    # Format conversion only: preserve the complete image and its existing marks.
    $articleBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $articleBitmap.Dispose() }
