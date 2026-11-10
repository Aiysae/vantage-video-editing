import Foundation
import AVFoundation
import Vision
import CoreImage
let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath:args[1]))
let track = asset.tracks(withMediaType:.video)[0]
let reader = try AVAssetReader(asset:asset)
let output = AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
reader.add(output)
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handle = FileHandle(forWritingAtPath:args[2])!
reader.startReading()
var n=0
while let sb=output.copyNextSampleBuffer(), let pb=CMSampleBufferGetImageBuffer(sb) {
 autoreleasepool {
  do {
   try VNImageRequestHandler(cvPixelBuffer:pb,options:[:]).perform([req])
   if let mask=req.results?.first?.pixelBuffer {
    CVPixelBufferLockBaseAddress(mask,.readOnly)
    let w=CVPixelBufferGetWidth(mask),h=CVPixelBufferGetHeight(mask),stride=CVPixelBufferGetBytesPerRow(mask)
    let ptr=CVPixelBufferGetBaseAddress(mask)!
    if n==0 {print("MASK \(w) \(h)")}
    for y in 0..<h {handle.write(Data(bytes:ptr.advanced(by:y*stride),count:w))}
    CVPixelBufferUnlockBaseAddress(mask,.readOnly)
   }
  } catch {print(error);exit(1)}
 }
 n += 1
 if n % 150 == 0 {print("frame \(n)")}
}
try handle.close()
print("DONE \(n)")
