[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

$root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"
$out  = Join-Path $root "assets\products"
$UA   = "HortifrutiImperialSiteBuilder/1.0 (static website; local development machine)"

function Get-Text($url) {
  for ($a = 1; $a -le 4; $a++) {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45 -Headers @{ "User-Agent" = $UA }).Content }
    catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}
function Save-Url($url, $dest) {
  for ($a = 1; $a -le 4; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -Headers @{ "User-Agent" = $UA }
      [IO.File]::WriteAllBytes($dest, $r.Content)
      return
    } catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}

# Extrai o nome REAL do arquivo a partir da URL devolvida pela API
function Get-FileName([string]$src) {
  $clean = ($src -split "\?")[0]
  $segs  = ([Uri]$clean).AbsolutePath.Split("/")
  if ($segs -contains "thumb") { return $segs[$segs.Length - 2] }
  return $segs[$segs.Length - 1]
}

$wiki = [ordered]@{
  "cenoura"   = "Carrot"
  "mangas"    = "Mango"
  "quiabo"    = "Okra"
  "morango"   = "Strawberry"
  "melon"     = "Melon"
}

foreach ($slug in $wiki.Keys) {
  $title = $wiki[$slug]
  $dest  = Join-Path $out "$slug.jpg"
  try {
    $j = (Get-Text ("https://en.wikipedia.org/api/rest_v1/page/summary/" + [uri]::EscapeDataString($title))) | ConvertFrom-Json
    if (-not $j.originalimage) { throw "sem imagem" }
    $name = Get-FileName $j.originalimage.source
    Save-Url ("https://en.wikipedia.org/wiki/Special:FilePath/" + $name + "?width=800") $dest
    Write-Output "$slug OK ($name)"
  } catch {
    Write-Output "$slug ERRO ($title): $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 3
}

# Categoria TEMPEROS — tentativas em ordem até achar uma foto válida
$dest = Join-Path $out "cat-temperos.jpg"
$queries = @(
  "fresh herbs bunch",
  "herbs spices market stall",
  "parsley basil cilantro bunch",
  "spices bowls market"
)
foreach ($q0 in $queries) {
  $achou = $false
  try {
    $q = [uri]::EscapeDataString($q0 + " filetype:bitmap")
    $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=$q&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json"
    $j = (Get-Text $api) | ConvertFrom-Json
    if ($j.query) {
      foreach ($p in @($j.query.pages.PSObject.Properties.Value)) {
        $ii = $p.imageinfo[0]
        if (-not $ii -or $ii.mime -ne "image/jpeg" -or $ii.width -lt 900) { continue }
        Save-Url $ii.thumburl $dest
        Write-Output "cat-temperos OK ($q0 -> $($p.title))"
        $achou = $true
        break
      }
    }
  } catch {
    Write-Output "cat-temperos tentativa '$q0' falhou: $($_.Exception.Message)"
  }
  if ($achou) { break }
  Start-Sleep -Seconds 3
}

Write-Output "DONE"
