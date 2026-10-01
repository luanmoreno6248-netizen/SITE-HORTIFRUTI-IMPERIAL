Add-Type -AssemblyName System.Drawing
$root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"

$bg = New-Object System.Drawing.Bitmap(760, 420)
$g = [System.Drawing.Graphics]::FromImage($bg)
$g.Clear([System.Drawing.Color]::FromArgb(255, 15, 61, 46))

$logo = New-Object System.Drawing.Bitmap((Join-Path $root "assets\logo.png"))
$g.DrawImage($logo, 30, 30, 360, 360)

$logo2 = New-Object System.Drawing.Bitmap((Join-Path $root "assets\logo.jpg"))
$g.DrawImage($logo2, 420, 30, 300, 300)

$font = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::White
$g.DrawString("ESQUERDA = logo.png (transparente)   |   DIREITA = logo.jpg (fundo branco)", $font, $brush, 30, 385)
$g.Dispose()
$bg.Save((Join-Path $root "tools\logo-preview.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bg.Dispose()
Write-Output "OK"
