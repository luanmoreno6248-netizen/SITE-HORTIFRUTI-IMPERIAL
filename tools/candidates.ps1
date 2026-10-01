[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

$root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"
$out  = Join-Path $root "tools\cand"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$UA = "HortifrutiImperialSiteBuilder/1.0 (static website; local development machine)"

function Get-Text($url) {
  for ($a = 1; $a -le 4; $a++) {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45 -Headers @{ "User-Agent" = $UA }).Content }
    catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}
function Save-Url($url, $dest) {
  for ($a = 1; $a -le 3; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -Headers @{ "User-Agent" = $UA }
      [IO.File]::WriteAllBytes($dest, $r.Content)
      return $true
    } catch { if ($a -eq 3) { return $false }; Start-Sleep -Seconds (3 * $a) }
  }
}

$alvos = [ordered]@{
  "cenoura"       = @("orange carrots bunch", "fresh carrots with tops", "carrot vegetable orange roots")
  "chuchu"        = @("chayote fruit sechium", "chayote vegetable", "chuchu sechium edule")
  "kiwi"          = @("kiwifruit halved actinidia", "kiwifruit sliced", "kiwi fruit cut open")
  "batata-branca" = @("white potatoes pile", "potatoes white skin", "potato tubers white")
  "cat-frutas"    = @("fresh fruits display market", "assorted fresh fruits", "fruit stall colourful fruits")
  "cat-verduras"  = @("fresh green vegetables lettuce", "green leafy vegetables bunch", "fresh vegetables greens market")
}

$n = 0
foreach ($slug in $alvos.Keys) {
  $k = 0
  foreach ($q0 in $alvos[$slug]) {
    $k++
    try {
      $q = [uri]::EscapeDataString($q0 + " filetype:bitmap")
      $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=$q&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json"
      $j = (Get-Text $api) | ConvertFrom-Json
      if (-not $j.query) { continue }
      $picks = @()
      foreach ($p in @($j.query.pages.PSObject.Properties.Value)) {
        $ii = $p.imageinfo[0]
        if (-not $ii -or $ii.mime -ne "image/jpeg" -or $ii.width -lt 900) { continue }
        if ($ii.thumburl -notmatch "/thumb/") { continue }
        $picks += $ii
      }
      if ($picks.Count -eq 0) { continue }
      $ii = $picks[0]
      $dest = Join-Path $out ("{0}-{1}.jpg" -f $slug, $k)
      if (Save-Url $ii.thumburl $dest) {
        Write-Output "$slug-$k OK  <- $q0"
        $n++
      }
    } catch {
      Write-Output "$slug-$k ERRO: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 3
  }
}
Write-Output "BAIXADOS: $n"

# Gera a folha de conferência dos candidatos
$cells = @()
foreach ($slug in $alvos.Keys) {
  for ($k = 1; $k -le 3; $k++) {
    $f = Join-Path $out ("{0}-{1}.jpg" -f $slug, $k)
    if (Test-Path $f) {
      $cells += "<div class=`"cell`"><img src=`"cand/$slug-$k.jpg`"><div class=`"name`">$slug-$k</div></div>"
    }
  }
}
$corpo = $cells -join ""
$html = @"
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Candidatos</title>
<style>
body{background:#fff;font-family:Arial;margin:0;padding:20px}
h1{font-size:20px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.cell{border:2px solid #0F3D2E;border-radius:8px;overflow:hidden;background:#FDF9F0}
.cell img{width:100%;height:170px;object-fit:cover;display:block;background:#eee}
.name{font-size:14px;font-weight:bold;padding:5px;text-align:center;color:#0F3D2E}
</style></head><body><h1>CANDIDATOS</h1><div class="grid">$corpo</div></body></html>
"@
Set-Content -Path (Join-Path $root "tools\cand.html") -Value $html -Encoding UTF8
Write-Output "DONE"
