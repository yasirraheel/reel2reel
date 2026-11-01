$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webRepo = Join-Path (Split-Path -Parent $repoRoot) "cineworm_org_full_final"
$server = "u273790872@82.25.96.181"
$serverRepo = "/home/u273790872/domains/cineworm.org/public_html/cineworm_org"

Push-Location $repoRoot
try {
  pnpm --filter @openreel/web build
  if ($LASTEXITCODE -ne 0) { throw "Reel2Reel build failed." }

  Copy-Item `
    -Path (Join-Path $repoRoot "apps\web\dist\*") `
    -Destination (Join-Path $webRepo "public\reel2reel") `
    -Recurse -Force

  git -C $webRepo add public/reel2reel
  $pending = git -C $webRepo status --short -- public/reel2reel
  if ($pending) {
    git -C $webRepo commit -m "Deploy Reel2Reel production build"
    if ($LASTEXITCODE -ne 0) { throw "Production repository commit failed." }
    git -C $webRepo push origin master
    if ($LASTEXITCODE -ne 0) { throw "Production repository push failed." }
  }

  ssh -p 65002 -o ConnectTimeout=20 -o BatchMode=yes $server `
    "cd $serverRepo && git pull --ff-only origin master"
  if ($LASTEXITCODE -ne 0) {
    throw "Server pull failed. Check the server repository lock or unrelated local changes."
  }
}
finally {
  Pop-Location
}
