param(
  [string]$Root = "C:\Users\PC\Pictures\HORTIFRUTI IMPERIAL",
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".png"  = "image/png"
  ".webp" = "image/webp"
  ".gif"  = "image/gif"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".woff2"= "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "SERVIDOR OK  http://localhost:$Port/  (root=$Root)"

$rootFull = [IO.Path]::GetFullPath($Root)

while ($true) {
  $ctx = $listener.GetContext()
  try {
    $req = $ctx.Request
    $res = $ctx.Response

    $raw = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($raw.EndsWith("/")) { $raw = $raw + "index.html" }

    $path = [IO.Path]::GetFullPath((Join-Path $rootFull $raw.TrimStart("\", "/")))

    if (-not $path.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }

    if (-not (Test-Path $path) -or (Get-Item $path).PSIsContainer) {
      $res.StatusCode = 404
      $buf = [Text.Encoding]::UTF8.GetBytes("404 Nao encontrado")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.Close()
      continue
    }

    $bytes = [IO.File]::ReadAllBytes($path)
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $res.StatusCode = 200
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $res.ContentLength64 = $bytes.Length
    $res.Headers["Cache-Control"] = "no-cache"
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  } catch {
    try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch { }
  }
}
