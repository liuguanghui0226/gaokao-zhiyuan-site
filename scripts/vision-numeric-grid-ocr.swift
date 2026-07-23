#!/usr/bin/env swift

import CoreGraphics
import Foundation
import ImageIO
import Vision

struct OCRCell: Encodable {
    let row: Int
    let col: String
    let text: String
    let confidence: Float
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}

struct OCRResult: Encodable {
    let imageWidth: Int
    let imageHeight: Int
    let rowCount: Int
    let cells: [OCRCell]
}

func usage() -> Never {
    fputs("Usage: vision-numeric-grid-ocr image rowCount firstRowTop rowPitch x0 x1 x2 x3 [scale]\n", stderr)
    fputs("Reads score, people, and cumulative numeric cells from one three-column table panel.\n", stderr)
    exit(2)
}

guard CommandLine.arguments.count == 9 || CommandLine.arguments.count == 10 else {
    usage()
}

let imagePath = CommandLine.arguments[1]
guard let rowCount = Int(CommandLine.arguments[2]),
      let firstRowTop = Double(CommandLine.arguments[3]),
      let rowPitch = Double(CommandLine.arguments[4]),
      let x0 = Int(CommandLine.arguments[5]),
      let x1 = Int(CommandLine.arguments[6]),
      let x2 = Int(CommandLine.arguments[7]),
      let x3 = Int(CommandLine.arguments[8]),
      rowCount > 0,
      rowPitch > 0,
      x0 >= 0,
      x1 > x0,
      x2 > x1,
      x3 > x2 else {
    usage()
}

let scale = CommandLine.arguments.count == 10 ? max(1, min(12, Int(CommandLine.arguments[9]) ?? 6)) : 6
let imageURL = URL(fileURLWithPath: imagePath)
guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let loadedImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fputs("Could not load image: \(imagePath)\n", stderr)
    exit(1)
}

func scaled(_ cgImage: CGImage, by scale: Int) -> CGImage {
    guard scale > 1 else { return cgImage }
    let width = max(1, cgImage.width * scale)
    let height = max(1, cgImage.height * scale)
    let colorSpace = cgImage.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return cgImage
    }
    context.interpolationQuality = .none
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    return context.makeImage() ?? cgImage
}

func recognizeDigits(_ cgImage: CGImage) throws -> (String, Float) {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.05
    let handler = VNImageRequestHandler(cgImage: scaled(cgImage, by: scale), options: [:])
    try handler.perform([request])
    let candidates = (request.results ?? []).compactMap { observation -> (String, Float)? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let digits = candidate.string.replacingOccurrences(of: #"[^0-9]"#, with: "", options: .regularExpression)
        return digits.isEmpty ? nil : (digits, candidate.confidence)
    }
    return candidates.max(by: { $0.1 < $1.1 }) ?? ("", 0)
}

let boundaries = [x0, x1, x2, x3]
let columnNames = ["score", "people", "cumulative"]
var cells: [OCRCell] = []

for row in 0..<rowCount {
    let rowTop = Int((firstRowTop + Double(row) * rowPitch).rounded())
    let rowBottom = Int((firstRowTop + Double(row + 1) * rowPitch).rounded())
    for column in 0..<3 {
        let left = boundaries[column] + 2
        let right = boundaries[column + 1] - 2
        let top = rowTop + 2
        let bottom = rowBottom - 2
        let rect = CGRect(x: left, y: top, width: max(1, right - left), height: max(1, bottom - top))
        guard let crop = loadedImage.cropping(to: rect) else {
            fputs("Could not crop row \(row) col \(columnNames[column])\n", stderr)
            exit(1)
        }
        let (text, confidence) = try recognizeDigits(crop)
        cells.append(OCRCell(
            row: row,
            col: columnNames[column],
            text: text,
            confidence: confidence,
            x: left,
            y: top,
            width: right - left,
            height: bottom - top
        ))
    }
}

let result = OCRResult(
    imageWidth: loadedImage.width,
    imageHeight: loadedImage.height,
    rowCount: rowCount,
    cells: cells
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(result)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
