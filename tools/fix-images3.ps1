[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

$root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"
$out  = Join-Path $root "assets\products"
$cand = Join-Path $root "tools\cand"
New-Item -ItemType Directory -Force -Path $cand | Out-Null
$UA = "HortifrutiImperialSiteBuilder/1.0 (static website; local development machine)"

function Get-Text($url) {
  for ($a = 1; $a -le 4; $a++) {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45 -Headers @{ "User-Agent" = $UA }).Content }
    catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}
function Save-FilePath($file, $dest) {
  $fe = [uri]::EscapeDataString($file)
  for ($a = 1; $a -le 4; $a++) {
    try {
      $r = Invoke-WebRequest -Uri ("https://commons.wikimedia.org/wiki/Special:FilePath/" + $fe + "?width=800") -UseBasicParsing -TimeoutSec 60 -Headers @{ "User-Agent" = $UA }
      [IO.File]::WriteAllBytes($dest, $r.Content)
      return $true
    } catch { if ($a -eq 4) { return $false }; Start-Sleep -Seconds (4 * $a) }
  }
}

# 1) Seleções definitivas (nomes de arquivo verificados na API da Wikipédia)
$fixos = [ordered]@{
  "cat-frutas"   = "Fruit_Platter-_Seasonal_Fruits.jpg"
  "cat-verduras" = "Spinach_leaves.jpg"
}
foreach ($k in $fixos.Keys) {
  $ok = Save-FilePath $fixos[$k] (Join-Path $out "$k.jpg")
  Write-Output "$k -> $(if($ok){'OK'}else{'ERRO'}) ($($fixos[$k]))"
  Start-Sleep -Seconds 3
}

# 2) Concorrentes de batata (para escolher o melhor)
Save-FilePath "Patates.jpg"          (Join-Path $cand "batata-b1.jpg") | Out-Null
Start-Sleep -Seconds 3
Save-FilePath "Batata.JPG"           (Join-Path $cand "batata-b2.jpg") | Out-Null
Start-Sleep -Seconds 3
Write-Output "batata candidatos baixados"

# 3) Candidatos de cenoura a partir da categoria "Carrots"
try {
  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=Category:Carrots&gcmtype=file&gcmlimit=40&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json"
  $j = (Get-Text $api) | ConvertFrom-Json
  $n = 0
  foreach ($p in @($j.query.pages.PSObject.Properties.Value)) {
    if ($n -ge 5) { break }
    $ii = $p.imageinfo[0]
    if (-not $ii -or $ii.mime -ne "image/jpeg" -or $ii.width -lt 900) { continue }
    $t = $p.title -replace "^File:", ""
    $n++
    $ok = Save-FilePath $t (Join-Path $cand "cenoura-c$n.jpg")
    Write-Output "cenoura-c$n -> $(if($ok){'OK'}else{'ERRO'}) ($t)"
    Start-Sleep -Seconds 3
  }
} catch {
  Write-Output "categoria cenoura ERRO: $($_.Exception.Message)"
}

Write-Output "DONE"
