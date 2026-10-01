[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

$root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"
$out  = Join-Path $root "assets\products"
$UA   = "HortifrutiImperialSiteBuilder/1.0 (static website; local development machine)"

function Get-Text($url) {
  for ($a = 1; $a -le 4; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45 -Headers @{ "User-Agent" = $UA }
      return $r.Content
    } catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}
function Get-File($url, $dest) {
  for ($a = 1; $a -le 4; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -Headers @{ "User-Agent" = $UA }
      [IO.File]::WriteAllBytes($dest, $r.Content)
      return $true
    } catch { if ($a -eq 4) { throw }; Start-Sleep -Seconds (4 * $a) }
  }
}

# slug -> artigo da Wikipédia em inglês (imagem de capa, curada e correta)
$wiki = [ordered]@{
  "cenoura"       = "Carrot"
  "batata-branca" = "Potato"
  "maca"          = "Apple"
  "pera"          = "Pear"
  "mangas"        = "Mango"
  "limao"         = "Lime (fruit)"
  "chuchu"        = "Chayote"
  "pepino"        = "Cucumber"
  "quiabo"        = "Okra"
  "morango"       = "Strawberry"
  "melon"         = "Melon"
  "kiwi"          = "Kiwifruit"
  "abobora"       = "Pumpkin"
}

foreach ($slug in $wiki.Keys) {
  $title = $wiki[$slug]
  $dest  = Join-Path $out "$slug.jpg"
  try {
    $enc = [uri]::EscapeDataString($title)
    $json = Get-Text "https://en.wikipedia.org/api/rest_v1/page/summary/$enc"
    $j = $json | ConvertFrom-Json
    if (-not $j.originalimage -or -not $j.originalimage.source) { throw "sem imagem original" }
    $srcUrl = $j.originalimage.source
    $file = [Uri]::UnescapeDataString(($srcUrl -split "\?")[0].Split("/")[-1])
    $fe = [uri]::EscapeDataString($file)
    Get-File "https://en.wikipedia.org/wiki/Special:FilePath/$fe`?width=800" $dest
    Write-Output "$slug  OK   ($title)"
  } catch {
    Write-Output "$slug  ERRO ($title): $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 3
}

# Categorias: buscas diretas no Commons com termos mais precisos
$catQueries = [ordered]@{
  "cat-frutas"   = "fruit market stall colourful filetype:bitmap"
  "cat-verduras" = "fresh green leaf vegetables lettuce bunch filetype:bitmap"
  "cat-temperos" = "fresh herbs bunch basil parsley filetype:bitmap"
}
foreach ($slug in $catQueries.Keys) {
  $dest = Join-Path $out "$slug.jpg"
  try {
    $q = [uri]::EscapeDataString($catQueries[$slug])
    $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=$q&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json"
    $j = (Get-Text $api) | ConvertFrom-Json
    if (-not $j.query) { throw "sem resultados" }
    $pick = $null
    foreach ($p in @($j.query.pages.PSObject.Properties.Value)) {
      $ii = $p.imageinfo[0]
      if (-not $ii) { continue }
      if ($ii.mime -ne "image/jpeg") { continue }
      if ($ii.width -lt 700) { continue }
      $pick = $ii; break
    }
    if (-not $pick) { throw "sem resultado utilizavel" }
    Get-File $pick.thumburl $dest
    Write-Output "$slug  OK   (commons)"
  } catch {
    Write-Output "$slug  ERRO: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 3
}

Write-Output "DONE"
