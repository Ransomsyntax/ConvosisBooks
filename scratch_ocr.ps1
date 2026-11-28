[Windows.Globalization.Language,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
} | Select-Object -First 1

function Await-Async($asyncOp, [Type]$targetType) {
    $method = $asTaskGeneric.MakeGenericMethod($targetType)
    $netTask = $method.Invoke($null, @($asyncOp))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

$lang = New-Object Windows.Globalization.Language("en-US")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }

$files = Get-ChildItem -Path "C:\Accounting\reference_screenshots" -Filter "*.png" -Recurse
$results = @{}

foreach ($f in $files) {
    try {
        $fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)
        $storageFile = Await-Async $fileOp ([Windows.Storage.StorageFile])

        $streamOp = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
        $stream = Await-Async $streamOp ([Windows.Storage.Streams.IRandomAccessStream])

        $decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = Await-Async $decOp ([Windows.Graphics.Imaging.BitmapDecoder])

        $bmpOp = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await-Async $bmpOp ([Windows.Graphics.Imaging.SoftwareBitmap])

        $ocrOp = $engine.RecognizeAsync($bitmap)
        $ocrResult = Await-Async $ocrOp ([Windows.Media.Ocr.OcrResult])

        $results[$f.Name] = $ocrResult.Text
        Write-Host "PROCESSED: $($f.Name) (lines: $($ocrResult.Lines.Count))"
    } catch {
        Write-Host "ERROR: $($f.Name) - $($_.Exception.ToString())"
    }
}

$json = $results | ConvertTo-Json -Depth 2
Set-Content -Path "C:\Accounting\reference_screenshots\ocr_summary.json" -Value $json -Encoding UTF8
Write-Host "OCR Complete! Total processed: $($results.Count)"
