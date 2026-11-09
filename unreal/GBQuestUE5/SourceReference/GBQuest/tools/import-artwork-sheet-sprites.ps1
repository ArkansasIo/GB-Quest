param(
  [string]$Sheet = (Join-Path (Get-Location) 'asset_image_archives\GB_Quest_Complete_Artwork_Pack\GB_Quest_Complete_Artwork_Pack\a_high_detail_comprehensive_game_asset_sheet_for_a.png'),
  [string]$Output = (Join-Path (Get-Location) 'assets')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Sheet -PathType Leaf)) { throw "Artwork sheet not found: $Sheet" }
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::new($Sheet)
if ($source.Width -ne 1536 -or $source.Height -ne 1024) {
  $source.Dispose()
  throw "Unexpected artwork sheet size $($source.Width)x$($source.Height); expected 1536x1024."
}
New-Item -ItemType Directory -Path $Output -Force | Out-Null

function Export-SpriteCutout([string]$Name, [int]$X, [int]$Y, [int]$Width, [int]$Height) {
  $rect = [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)
  $sprite = $source.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  $visited = [System.Collections.Generic.HashSet[int]]::new()
  $w = $sprite.Width; $h = $sprite.Height
  $isBackground = { param($c) $c.R -lt 50 -and $c.G -lt 50 -and $c.B -lt 72 }
  for ($x = 0; $x -lt $w; $x++) {
    foreach ($y in @(0, ($h - 1))) {
      if (& $isBackground $sprite.GetPixel($x, $y)) { $queue.Enqueue([System.Drawing.Point]::new($x, $y)) }
    }
  }
  for ($y = 1; $y -lt ($h - 1); $y++) {
    foreach ($x in @(0, ($w - 1))) {
      if (& $isBackground $sprite.GetPixel($x, $y)) { $queue.Enqueue([System.Drawing.Point]::new($x, $y)) }
    }
  }
  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    $idx = $point.Y * $w + $point.X
    if (-not $visited.Add($idx)) { continue }
    $color = $sprite.GetPixel($point.X, $point.Y)
    if (-not (& $isBackground $color)) { continue }
    $sprite.SetPixel($point.X, $point.Y, [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
    if ($point.X -gt 0) { $queue.Enqueue([System.Drawing.Point]::new($point.X - 1, $point.Y)) }
    if ($point.X -lt ($w - 1)) { $queue.Enqueue([System.Drawing.Point]::new($point.X + 1, $point.Y)) }
    if ($point.Y -gt 0) { $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y - 1)) }
    if ($point.Y -lt ($h - 1)) { $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y + 1)) }
  }
  $path = Join-Path $Output ($Name + '.png')
  $sprite.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $sprite.Dispose()
}

# The supplied contact sheet shows 20 character sprites and 14 enemy sprites.
for ($row = 0; $row -lt 2; $row++) {
  for ($column = 0; $column -lt 10; $column++) {
    $index = $row * 10 + $column
    Export-SpriteCutout ('ap_characters_{0:d3}' -f $index) (380 + 42 * $column) (35 + 62 * $row) 36 60
  }
  for ($column = 0; $column -lt 7; $column++) {
    $index = $row * 7 + $column
    $enemyY = if ($row -eq 0) { 39 } else { 94 }
    $enemyHeight = if ($row -eq 0) { 52 } else { 58 }
    Export-SpriteCutout ('ap_enemies_{0:d3}' -f $index) (812 + 58 * $column) $enemyY 50 $enemyHeight
  }
}
$scene = $source.Clone([System.Drawing.Rectangle]::new(5, 856, 390, 147), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$scene.Save((Join-Path $Output 'ap_scene_shadowbane.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$scene.Dispose()
$source.Dispose()
Write-Output 'Imported 20 characters, 14 enemies, and the Aelmoor cutscene illustration.'
