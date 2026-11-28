Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.IO.Compression.FileSystem

[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    $lang = New-Object Windows.Globalization.Language("en-US")
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
}

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
} | Select-Object -First 1

function Await-Async($asyncOp, [Type]$targetType) {
    $method = $asTaskGeneric.MakeGenericMethod($targetType)
    $netTask = $method.Invoke($null, @($asyncOp))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

$files = Get-ChildItem -Path "C:\Accounting\reference_screenshots" -Filter "*.png" -Recurse
$results = [System.Collections.Generic.Dictionary[string, string]]::new()

foreach ($f in $files) {
    try {
        $fileStream = [System.IO.File]::OpenRead($f.FullName)
        $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fileStream)

        $decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)
        $decoder = Await-Async $decOp ([Windows.Graphics.Imaging.BitmapDecoder])

        $bmpOp = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await-Async $bmpOp ([Windows.Graphics.Imaging.SoftwareBitmap])

        $ocrOp = $engine.RecognizeAsync($bitmap)
        $ocrResult = Await-Async $ocrOp ([Windows.Media.Ocr.OcrResult])

        $results[$f.Name] = $ocrResult.Text
        $fileStream.Close()
        Write-Host "PROCESSED: $($f.Name) (lines: $($ocrResult.Lines.Count))"
    } catch {
        Write-Host "ERROR: $($f.Name) - $($_.Exception.ToString())"
    }
}

$json = $results | ConvertTo-Json
Set-Content -Path "C:\Accounting\reference_screenshots\ocr_summary.json" -Value $json -Encoding UTF8
Write-Host "SUCCESS! All screenshots OCR-processed."
