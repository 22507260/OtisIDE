param(
  [string]$SourcePath = "build/icon-source.png",
  [string]$PngOutputPath = "build/icon.png",
  [string]$IcoOutputPath = "build/icon.ico"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeMethods {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

function New-SquareBitmap {
  param(
    [System.Drawing.Image]$Image,
    [int]$Size
  )

  $side = [Math]::Min($Image.Width, $Image.Height)
  $cropX = [int][Math]::Floor(($Image.Width - $side) / 2)
  $cropY = [int][Math]::Floor(($Image.Height - $side) / 2)

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $destination = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $source = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
    $graphics.DrawImage($Image, $destination, $source, [System.Drawing.GraphicsUnit]::Pixel)
  }
  finally {
    $graphics.Dispose()
  }

  return $bitmap
}

function Save-PngFromBitmap {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-IcoFromBitmap {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  if ($directory) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $iconHandle = $Bitmap.GetHicon()
  try {
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    try {
      $icon.Save($stream)
    }
    finally {
      $stream.Dispose()
      $icon.Dispose()
    }
  }
  finally {
    [NativeMethods]::DestroyIcon($iconHandle) | Out-Null
  }
}

$resolvedSourcePath = (Resolve-Path $SourcePath).Path
$sourceImage = [System.Drawing.Image]::FromFile($resolvedSourcePath)

try {
  $baseBitmap = New-SquareBitmap -Image $sourceImage -Size 1024
  try {
    Save-PngFromBitmap -Bitmap $baseBitmap -Path $PngOutputPath
  }
  finally {
    $baseBitmap.Dispose()
  }

  $iconBitmap = New-SquareBitmap -Image $sourceImage -Size 256
  try {
    Save-IcoFromBitmap -Bitmap $iconBitmap -Path $IcoOutputPath
  }
  finally {
    $iconBitmap.Dispose()
  }
}
finally {
  $sourceImage.Dispose()
}
