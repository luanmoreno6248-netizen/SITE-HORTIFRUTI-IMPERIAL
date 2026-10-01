[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Stop"

$root  = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL"
$out   = Join-Path $root "assets\products"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$UA = "HortifrutiImperialSiteBuilder/1.0 (static website; local development machine)"

$items = @(
  @{ slug = "cebola-branca";    q = "white onion bulbs" },
  @{ slug = "cebola-roxa";      q = "red onion bulbs" },
  @{ slug = "tomates";          q = "tomato fruit red" },
  @{ slug = "pimentao";         q = "bell pepper capsicum" },
  @{ slug = "cenoura";          q = "carrot daucus carota" },
  @{ slug = "batatinha";        q = "baby potatoes small" },
  @{ slug = "batata-branca";    q = "potato tubers white" },
  @{ slug = "uva-roxa";         q = "red grapes bunch" },
  @{ slug = "uva-verde";        q = "green grapes bunch" },
  @{ slug = "maca";             q = "apple fruit red" },
  @{ slug = "pera";             q = "pear fruit" },
  @{ slug = "abacaxi";          q = "pineapple fruit ananas" },
  @{ slug = "goiaba";           q = "guava fruit psidium" },
  @{ slug = "mangas";           q = "mango fruit mangifera" },
  @{ slug = "melon";            q = "melon fruit cucumis melo" },
  @{ slug = "abacate";          q = "avocado fruit persea" },
  @{ slug = "limao";            q = "lime fruit citrus" },
  @{ slug = "inhame";           q = "taro root colocasia" },
  @{ slug = "chuchu";           q = "chayote sechium" },
  @{ slug = "pepino";           q = "cucumber fruit" },
  @{ slug = "abobora";          q = "pumpkin cucurbita fruit" },
  @{ slug = "quiabo";           q = "okra pods abelmoschus" },
  @{ slug = "maracuja";         q = "passion fruit passiflora" },
  @{ slug = "kiwi";             q = "kiwifruit actinidia cut" },
  @{ slug = "ameixa-fresca";    q = "plum fruit prunus" },
  @{ slug = "morango";          q = "strawberry fruit fragaria" },
  @{ slug = "pocam";            q = "yellow mango fruit" },
  @{ slug = "cat-frutas";       q = "assorted fresh fruits" },
  @{ slug = "cat-verduras";     q = "leafy green vegetables lettuce" },
  @{ slug = "cat-legumes";      q = "assorted vegetables carrots" },
  @{ slug = "cat-temperos";     q = "fresh herbs spices" }
)

function Get-Json($url) {
  for ($a = 1; $a -le 5; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 45 -Headers @{ "User-Agent" = $UA }
      return ($r.Content | ConvertFrom-Json)
    } catch {
      if ($a -eq 5) { throw }
      Start-Sleep -Seconds (5 * $a)
    }
  }
}

function Get-Bytes($url) {
  for ($a = 1; $a -le 5; $a++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 60 -Headers @{ "User-Agent" = $UA }
      return $r.Content
    } catch {
      if ($a -eq 5) { throw }
      Start-Sleep -Seconds (5 * $a)
    }
  }
}

$fail = @()
foreach ($it in $items) {
  $slug = $it.slug
  $dest = Join-Path $out "$slug.jpg"
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 5000)) {
    Write-Output "$slug -> ja existe"
    continue
  }
  try {
    $pick = $null
    foreach ($suffix in @(" filemime:image/jpeg", "")) {
      $q = [uri]::EscapeDataString($it.q + $suffix)
      $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=$q&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json"
      $j = Get-Json $api
      if (-not $j.query) { continue }
      $pages = @($j.query.pages.PSObject.Properties.Value)
      foreach ($p in $pages) {
        $ii = $p.imageinfo[0]
        if (-not $ii) { continue }
        if ($ii.mime -ne "image/jpeg") { continue }
        if ($ii.width -lt 400 -or $ii.height -lt 300) { continue }
        $pick = $ii
        break
      }
      if ($pick) { break }
      Start-Sleep -Seconds 3
    }
    if (-not $pick) { throw "sem resultado utilizavel" }
    $bytes = Get-Bytes $pick.thumburl
    [IO.File]::WriteAllBytes($dest, $bytes)
    Write-Output "$slug -> OK"
  } catch {
    $fail += $slug
    Write-Output "$slug -> ERRO: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 4
}

Write-Output ("FALHARAM: " + ($fail -join ", "))
Write-Output "DONE"
