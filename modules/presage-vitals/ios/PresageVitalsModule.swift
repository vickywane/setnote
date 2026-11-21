import AVFoundation
import CoreImage
import ExpoModulesCore
import Observation
import SmartSpectra
import UIKit

/// Recovery check: wraps the SmartSpectra SDK so JS can start and stop a camera measurement,
/// receive pulse, breathing and HRV samples as they arrive, and show the camera preview.
public class PresageVitalsModule: Module {
  private let session = VitalsSession()

  public func definition() -> ModuleDefinition {
    Name("PresageVitals")

    Events("onUpdate")

    OnCreate { [weak self] in
      self?.session.emit = { [weak self] payload in
        self?.sendEvent("onUpdate", payload)
      }
    }

    OnDestroy {
      let session = self.session
      Task { @MainActor in _ = try? await session.stop() }
    }

    // videoPath: where to record the check as an MP4 (a file:// URI or a path), or null.
    AsyncFunction("start") { (apiKey: String, videoPath: String?) async throws in
      try await self.session.start(apiKey: apiKey, videoPath: videoPath)
    }

    // Returns the recorded video ({ uri, durationMs }) when the check was recording one.
    AsyncFunction("stop") { () async throws -> [String: Any]? in
      try await self.session.stop()
    }

    View(PresageVitalsPreview.self) {}
  }
}

/// Collects the samples the SDK publishes and hands them to JS in small batches.
final class VitalsSession: @unchecked Sendable {
  var emit: (([String: Any]) -> Void)?

  @MainActor private var observing = false
  @MainActor private var timer: Timer?
  @MainActor private var pending = Pending()
  @MainActor private var lastPulseTs: Int64 = 0
  @MainActor private var lastBreathingTs: Int64 = 0
  @MainActor private var lastHrvTs: Int64 = 0
  @MainActor private var recorder: FrameRecorder?

  private struct Pending {
    var pulse: [[String: Any]] = []
    var breathing: [[String: Any]] = []
    var hrv: [[String: Any]] = []
  }

  @MainActor
  func start(apiKey: String, videoPath: String?) async throws {
    let sdk = SmartSpectraSDK.shared
    if sdk.processingStatus == .running || sdk.processingStatus == .starting { return }

    sdk.config.apiKey = apiKey
    // Nothing leaves the phone except what the SDK needs to measure; no usage telemetry.
    sdk.config.enableTelemetry = false
    sdk.config.imageOutputEnabled = true
    sdk.config.requestedMetrics = SmartSpectraConfig.breathingMetrics + [.pulseRate, .hrv]

    pending = Pending()
    lastPulseTs = 0
    lastBreathingTs = 0
    lastHrvTs = 0
    observing = true
    observeMetrics()
    if let videoPath {
      let url = videoPath.hasPrefix("file://")
        ? URL(string: videoPath) ?? URL(fileURLWithPath: videoPath)
        : URL(fileURLWithPath: videoPath)
      recorder = FrameRecorder(url: url)
      observeImages()
    }

    do {
      try await sdk.start()
    } catch {
      stopEmitting()
      recorder?.cancel()
      recorder = nil
      throw error
    }

    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.flush() }
    }
  }

  @MainActor
  func stop() async throws -> [String: Any]? {
    let sdk = SmartSpectraSDK.shared
    collect()
    flush()
    stopEmitting()
    let recording = recorder
    recorder = nil
    if sdk.processingStatus == .running || sdk.processingStatus == .starting {
      try await sdk.stop()
    }
    guard let video = await recording?.finish() else { return nil }
    return ["uri": video.url.absoluteString, "durationMs": video.durationMs]
  }

  /// While recording, hands every new camera frame to the recorder.
  @MainActor
  private func observeImages() {
    guard let recorder else { return }
    let image = withObservationTracking {
      SmartSpectraSDK.shared.imageOutput
    } onChange: { [weak self] in
      Task { @MainActor in self?.observeImages() }
    }
    if let image { recorder.append(image) }
  }

  @MainActor
  private func stopEmitting() {
    observing = false
    timer?.invalidate()
    timer = nil
  }

  /// Each `metrics` payload holds only the samples since the previous one, so read every
  /// payload rather than polling: re-arm the observation after each change.
  @MainActor
  private func observeMetrics() {
    guard observing else { return }
    withObservationTracking {
      _ = SmartSpectraSDK.shared.metrics
    } onChange: { [weak self] in
      Task { @MainActor in
        guard let self, self.observing else { return }
        self.collect()
        self.observeMetrics()
      }
    }
  }

  @MainActor
  private func collect() {
    guard let metrics = SmartSpectraSDK.shared.metrics else { return }

    for sample in metrics.cardio.pulseRate where sample.timestamp > lastPulseTs {
      lastPulseTs = sample.timestamp
      pending.pulse.append([
        "value": Double(sample.value),
        "confidence": Double(sample.confidence),
        "stable": sample.stable,
        "timestamp": Double(sample.timestamp),
      ])
    }
    for sample in metrics.breathing.rate where sample.timestamp > lastBreathingTs {
      lastBreathingTs = sample.timestamp
      pending.breathing.append([
        "value": Double(sample.value),
        "confidence": Double(sample.confidence),
        "stable": sample.stable,
        "timestamp": Double(sample.timestamp),
      ])
    }
    for sample in metrics.cardio.hrv where sample.timestamp > lastHrvTs {
      lastHrvTs = sample.timestamp
      pending.hrv.append([
        "value": sample.rmssd,
        "confidence": Double(sample.confidence),
        "stable": sample.stable,
        "timestamp": Double(sample.timestamp),
      ])
    }
  }

  @MainActor
  private func flush() {
    let sdk = SmartSpectraSDK.shared
    var payload: [String: Any] = [
      "status": String(describing: sdk.processingStatus),
      "pulse": pending.pulse,
      "breathing": pending.breathing,
      "hrv": pending.hrv,
    ]
    if let validation = sdk.validationStatus {
      payload["validation"] = String(describing: validation.code)
      payload["hint"] = validation.hint
    }
    if let error = sdk.error {
      payload["error"] = ["code": String(describing: error.code), "message": error.message]
    }
    pending = Pending()
    emit?(payload)
  }
}

/// The SDK's camera frames (it owns the camera while measuring). Follows Presage's UIKit
/// sample: observe `imageOutput` and hand each new frame to a UIImageView.
public final class PresageVitalsPreview: ExpoView {
  private let imageView = UIImageView()
  private var observing = false

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    imageView.contentMode = .scaleAspectFill
    imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    imageView.frame = bounds
    addSubview(imageView)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = bounds
  }

  public override func didMoveToWindow() {
    super.didMoveToWindow()
    observing = window != nil
    if observing { observeImage() }
  }

  private func observeImage() {
    guard observing else { return }
    let image = withObservationTracking {
      SmartSpectraSDK.shared.imageOutput
    } onChange: { [weak self] in
      Task { @MainActor in self?.observeImage() }
    }
    imageView.image = image
  }
}

/// Writes the SDK's camera frames (what the preview shows) to an H.264 MP4, so the check can
/// be watched again. Frames are timed as they arrive.
@MainActor
final class FrameRecorder {
  private let url: URL
  private var writer: AVAssetWriter?
  private var input: AVAssetWriterInput?
  private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var size = CGSize.zero
  private var startedAt: CFTimeInterval?
  private var lastTime = CMTime.invalid
  private var failed = false
  private let context = CIContext()
  /// Longest side of the video; the preview frames are larger than a rewatch needs.
  private let maxSide: CGFloat = 1280

  init(url: URL) {
    self.url = url
    try? FileManager.default.removeItem(at: url)
  }

  func append(_ image: UIImage) {
    guard !failed, let frame = Self.ciImage(of: image) else { return }
    if writer == nil, !setUp(for: frame.extent.size) { return }
    guard let input, let adaptor, input.isReadyForMoreMediaData,
      let pool = adaptor.pixelBufferPool
    else { return }

    let now = CACurrentMediaTime()
    if startedAt == nil { startedAt = now }
    let time = CMTime(seconds: now - (startedAt ?? now), preferredTimescale: 600)
    if lastTime.isValid, time <= lastTime { return }

    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let buffer else { return }
    let scale = size.width / frame.extent.width
    let scaled = frame
      .transformed(by: CGAffineTransform(translationX: -frame.extent.minX, y: -frame.extent.minY))
      .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    context.render(scaled, to: buffer)
    if adaptor.append(buffer, withPresentationTime: time) { lastTime = time }
  }

  /// Finishes the file. Nil when nothing was recorded (the file is removed).
  func finish() async -> (url: URL, durationMs: Double)? {
    guard let writer, let input, writer.status == .writing, lastTime.isValid else {
      cancel()
      return nil
    }
    input.markAsFinished()
    writer.endSession(atSourceTime: lastTime)
    await writer.finishWriting()
    guard writer.status == .completed else {
      try? FileManager.default.removeItem(at: url)
      return nil
    }
    return (url, lastTime.seconds * 1000)
  }

  func cancel() {
    writer?.cancelWriting()
    try? FileManager.default.removeItem(at: url)
  }

  private func setUp(for frameSize: CGSize) -> Bool {
    let fit = min(1, maxSide / max(frameSize.width, frameSize.height))
    // H.264 wants even dimensions.
    let width = Int(frameSize.width * fit) / 2 * 2
    let height = Int(frameSize.height * fit) / 2 * 2
    guard width > 0, height > 0,
      let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4)
    else {
      failed = true
      return false
    }
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 1_500_000],
    ])
    input.expectsMediaDataInRealTime = true
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ])
    guard writer.canAdd(input) else {
      failed = true
      return false
    }
    writer.add(input)
    guard writer.startWriting() else {
      failed = true
      return false
    }
    writer.startSession(atSourceTime: .zero)
    self.writer = writer
    self.input = input
    self.adaptor = adaptor
    size = CGSize(width: width, height: height)
    return true
  }

  /// The frame upright, whether the UIImage is backed by a CGImage or a CIImage.
  private static func ciImage(of image: UIImage) -> CIImage? {
    let base = image.ciImage ?? image.cgImage.map { CIImage(cgImage: $0) }
    return base?.oriented(orientation(of: image.imageOrientation))
  }

  private static func orientation(of o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
