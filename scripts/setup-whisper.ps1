param([ValidateSet('base','small')][string]$Size = 'small', [switch]$InstallFfmpeg)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Version = 'v1.7.6' # a8d002cfd879315632a579e73f0148d06959de36, same as setup-whisper.sh
$ArchiveSha = '0d2eca299c248f965bd0341bcb219db4b433c7f0c0ce2200d4df85765e8156a9'
$ModelSha = @{ base = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'; small = '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b' }
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') { throw 'Script này ghim bản Windows x64. ARM64 chưa được kiểm chứng.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -and -not $env:FFMPEG_PATH) {
  if ($InstallFfmpeg) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Cần App Installer/winget: https://aka.ms/getwinget' }
    winget install --id Gyan.FFmpeg --exact
    if ($LASTEXITCODE -ne 0) { throw 'winget chưa cài được ffmpeg.' }
    Write-Host 'Nếu chưa thấy ffmpeg, đóng rồi mở lại terminal hoặc đặt FFMPEG_PATH.'
  } else { Write-Host 'Cần ffmpeg cho nhận dạng và thanh điệu: winget install --id Gyan.FFmpeg --exact (hoặc chạy lại với -InstallFfmpeg).' }
}
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) ('misu-whisper-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Temp | Out-Null
try {
  $Zip = Join-Path $Temp 'whisper.zip'
  Invoke-WebRequest "https://github.com/ggml-org/whisper.cpp/releases/download/$Version/whisper-bin-x64.zip" -OutFile $Zip
  if ((Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ArchiveSha) { throw 'SHA256 bản whisper không khớp. Dừng cài đặt.' }
  Expand-Archive $Zip -DestinationPath (Join-Path $Temp 'unpacked')
  $Target = Join-Path $Root 'vendor/whisper-windows'
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Copy-Item (Join-Path $Temp 'unpacked/Release/*') $Target -Force
  if (-not (Test-Path (Join-Path $Target 'whisper-server.exe'))) { throw 'Release thiếu whisper-server.exe.' }
  $Models = Join-Path $Root 'models'
  New-Item -ItemType Directory -Force -Path $Models | Out-Null
  $Model = Join-Path $Models "ggml-$Size.bin"
  if (-not (Test-Path $Model) -or (Get-FileHash $Model -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ModelSha[$Size]) {
    $Part = Join-Path $Temp 'model.bin'
    Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$Size.bin" -OutFile $Part
    if ((Get-FileHash $Part -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ModelSha[$Size]) { throw 'SHA256 model không khớp. Dừng cài đặt.' }
    Move-Item $Part $Model -Force
  }
  Write-Host "Đã chuẩn bị whisper-server.exe $Version và model $Size."
  if ($Size -ne 'small') { Write-Host "Trước khi chạy app: `$env:WHISPER_MODEL = '$Model'" }
  Write-Host 'Nếu lỗi thiếu VCRUNTIME/MSVCP, cài Visual C++ Redistributable x64: https://aka.ms/vs/17/release/vc_redist.x64.exe'
} finally { Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue }
