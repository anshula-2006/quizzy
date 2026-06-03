$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$assets = Join-Path $root "poster\assets"
$outDir = Join-Path $root "G-___Quiz Generator\Videos"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$pptPath = Join-Path $outDir "Quiz_Generator_Demo.pptx"
$videoPath = Join-Path $outDir "Quiz_Generator_Demo.mp4"

Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $pptPath, $videoPath

$slides = @(
    @{ Image = "Quizzy.png"; Title = "Quizzy"; Subtitle = "AI-powered quiz generation and study practice" },
    @{ Image = "homepage.png"; Title = "Home"; Subtitle = "Students start from a clean dashboard for quiz creation and study tools" },
    @{ Image = "generate.png"; Title = "Generate Quizzes"; Subtitle = "Users enter or upload learning content and generate questions instantly" },
    @{ Image = "dashboard.png"; Title = "Student Dashboard"; Subtitle = "Quiz history, progress, stats, and learning activity are organized in one place" },
    @{ Image = "results.png"; Title = "Results"; Subtitle = "The app shows scores and feedback after each quiz attempt" },
    @{ Image = "teacher.png"; Title = "Teacher Review"; Subtitle = "Teachers can review questions, monitor activity, and support learners" },
    @{ Image = "brain-lab.png"; Title = "Complete Study Toolkit"; Subtitle = "Quizzy combines quiz generation, flashcards, practice games, and progress tracking" }
)

function Add-TextBox($slide, [string]$text, [double]$left, [double]$top, [double]$width, [double]$height, [int]$size, [bool]$bold) {
    $box = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $box.TextFrame.TextRange.Text = $text
    $box.TextFrame.TextRange.Font.Name = "Aptos Display"
    $box.TextFrame.TextRange.Font.Size = $size
    $box.TextFrame.TextRange.Font.Bold = $(if ($bold) { -1 } else { 0 })
    $box.TextFrame.TextRange.Font.Color.RGB = 0x202020
    return $box
}

function Fit-Picture($shape, [double]$boxLeft, [double]$boxTop, [double]$boxWidth, [double]$boxHeight) {
    $ratio = [Math]::Min($boxWidth / $shape.Width, $boxHeight / $shape.Height)
    $shape.Width = $shape.Width * $ratio
    $shape.Height = $shape.Height * $ratio
    $shape.Left = $boxLeft + (($boxWidth - $shape.Width) / 2)
    $shape.Top = $boxTop + (($boxHeight - $shape.Height) / 2)
}

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1

try {
    $presentation = $powerPoint.Presentations.Add()
    $presentation.PageSetup.SlideWidth = 1280
    $presentation.PageSetup.SlideHeight = 720

    foreach ($item in $slides) {
        $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
        $slide.FollowMasterBackground = 0
        $slide.Background.Fill.ForeColor.RGB = 0xF7F7F3

        $accent = $slide.Shapes.AddShape(1, 0, 0, 1280, 8)
        $accent.Fill.ForeColor.RGB = 0x2D7D7A
        $accent.Line.Visible = 0

        Add-TextBox $slide $item.Title 64 34 540 48 30 $true | Out-Null
        Add-TextBox $slide $item.Subtitle 64 82 760 50 17 $false | Out-Null

        $imagePath = Join-Path $assets $item.Image
        $picture = $slide.Shapes.AddPicture($imagePath, 0, -1, 64, 145, -1, -1)
        Fit-Picture $picture 64 145 1152 510

        $slide.SlideShowTransition.AdvanceOnTime = -1
        $slide.SlideShowTransition.AdvanceTime = 4
    }

    $presentation.SaveAs($pptPath)
    $presentation.CreateVideo($videoPath, $true, 4, 720, 24, 85)

    $deadline = (Get-Date).AddMinutes(8)
    do {
        Start-Sleep -Seconds 5
        $status = $presentation.CreateVideoStatus
    } while ($status -ne 3 -and (Get-Date) -lt $deadline)

    $presentation.Close()
}
finally {
    $powerPoint.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
}

if (-not (Test-Path $videoPath)) {
    throw "PowerPoint did not finish exporting the video. The PPTX was created at $pptPath."
}

Write-Output "Created $videoPath"
