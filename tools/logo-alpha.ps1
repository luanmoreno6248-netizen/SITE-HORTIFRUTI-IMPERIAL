Add-Type -AssemblyName System.Drawing

$src = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL\assets\logo.jpg"
$dst = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL\assets\logo.png"

$bmp = New-Object System.Drawing.Bitmap($src)
$w = $bmp.Width
$h = $bmp.Height

# Ler canais
$R = New-Object byte[] ($w * $h)
$G = New-Object byte[] ($w * $h)
$B = New-Object byte[] ($w * $h)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $i = $y * $w + $x
    $R[$i] = $c.R; $G[$i] = $c.G; $B[$i] = $c.B
  }
}
$bmp.Dispose()

# minimo canal
$minc = New-Object byte[] ($w * $h)
for ($i = 0; $i -lt $w * $h; $i++) {
  $m = $R[$i]
  if ($G[$i] -lt $m) { $m = $G[$i] }
  if ($B[$i] -lt $m) { $m = $B[$i] }
  $minc[$i] = $m
}

# BFS a partir das bordas sobre pixels claros (fundo branco ligado à borda)
$TH = 210
$visited = New-Object bool[] ($w * $h)
$queue = New-Object 'System.Collections.Generic.Queue[int]'

function Enqueue-IfLight([int]$i) {
  if ($visited[$i]) { return }
  if ($minc[$i] -lt $TH) { return }
  $visited[$i] = $true
  $queue.Enqueue($i)
}

for ($x = 0; $x -lt $w; $x++) { Enqueue-IfLight $x; Enqueue-IfLight (($h - 1) * $w + $x) }
for ($y = 0; $y -lt $h; $y++) { Enqueue-IfLight ($y * $w); Enqueue-IfLight ($y * $w + $w - 1) }

while ($queue.Count -gt 0) {
  $i = $queue.Dequeue()
  $x = $i % $w
  $y = [int]($i / $w)
  if ($x -gt 0) { Enqueue-IfLight ($i - 1) }
  if ($x -lt ($w - 1)) { Enqueue-IfLight ($i + 1) }
  if ($y -gt 0) { Enqueue-IfLight ($i - $w) }
  if ($y -lt ($h - 1)) { Enqueue-IfLight ($i + $w) }
}

# Gerar PNG com alfa (rampa de suavização 210 -> 248)
$out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $i = $y * $w + $x
    if ($visited[$i]) {
      $m = [int]$minc[$i]
      $t = ($m - 210) / 38.0
      if ($t -lt 0) { $t = 0 }
      if ($t -gt 1) { $t = 1 }
      $a = [int](255 * (1 - $t))
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $R[$i], $G[$i], $B[$i]))
    } else {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $R[$i], $G[$i], $B[$i]))
    }
  }
}

$out.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Output ("SALVO: " + $dst)
