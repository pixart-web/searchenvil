import AppKit
import Foundation

let iconset = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

let face: [CGPoint] = [
    .init(x: 8, y: 14.5), .init(x: 11.5, y: 12), .init(x: 28.5, y: 12),
    .init(x: 32, y: 14.5), .init(x: 31.2, y: 17.5), .init(x: 8.8, y: 17.5)
]
let base: [CGPoint] = [
    .init(x: 11, y: 26.5), .init(x: 14.5, y: 24), .init(x: 25.5, y: 24),
    .init(x: 29, y: 26.5), .init(x: 27.8, y: 30), .init(x: 12.2, y: 30)
]

func fill(_ points: [CGPoint], in context: CGContext) {
    context.beginPath()
    context.addLines(between: points)
    context.closePath()
    context.fillPath()
}

for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        )!
        let context = NSGraphicsContext(bitmapImageRep: bitmap)!.cgContext
        context.translateBy(x: 0, y: CGFloat(pixels))
        context.scaleBy(x: CGFloat(pixels) / 40, y: -CGFloat(pixels) / 40)
        context.setFillColor(red: 0.851, green: 0.541, blue: 0.271, alpha: 1)
        context.addPath(CGPath(
            roundedRect: CGRect(x: 2, y: 2, width: 36, height: 36),
            cornerWidth: 9, cornerHeight: 9, transform: nil
        ))
        context.fillPath()
        context.setFillColor(red: 0.961, green: 0.949, blue: 0.925, alpha: 1)
        fill(face, in: context)
        context.fill(CGRect(x: 16.5, y: 18, width: 7, height: 5))
        fill(base, in: context)
        let suffix = scale == 1 ? "" : "@2x"
        let name = "icon_\(size)x\(size)\(suffix).png"
        try bitmap.representation(using: .png, properties: [:])!.write(
            to: iconset.appendingPathComponent(name)
        )
    }
}
