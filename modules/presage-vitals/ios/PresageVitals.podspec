require 'digest'
require 'fileutils'

# Wraps the Presage SmartSpectra Swift SDK (camera-based pulse, breathing and HRV) for the
# recovery check. The SDK ships only as a Swift package around a prebuilt, dynamic
# xcframework, so this pod downloads that same xcframework (pinned by version and SHA-256,
# the values in the package's Package.swift) and vendors it. CocoaPods then links and embeds
# it like any vendored framework, which a Swift package added to a pod target can't do.
#
# The framework (~64 MB zipped) is kept out of git; it is fetched on `pod install`, locally
# and on EAS. To upgrade, change both values below to the ones in the new release's
# https://github.com/Presage-Security/SmartSpectra-Swift/blob/<tag>/Package.swift
smart_spectra_version = '3.5.0'
smart_spectra_sha256 = '6ddbccaa3b4f30ec109b3f137f601ea6f5b056fce6026e72e70d0fddb7b1a451'

frameworks_dir = File.join(__dir__, 'Frameworks')
framework_path = File.join(frameworks_dir, 'SmartSpectra.xcframework')
stamp_path = File.join(frameworks_dir, '.version')

unless File.exist?(framework_path) && File.exist?(stamp_path) && File.read(stamp_path).strip == smart_spectra_version
  url = "https://github.com/Presage-Security/SmartSpectra-Swift/releases/download/v#{smart_spectra_version}/SmartSpectra.xcframework.zip"
  zip_path = File.join(frameworks_dir, 'SmartSpectra.xcframework.zip')
  FileUtils.rm_rf(frameworks_dir)
  FileUtils.mkdir_p(frameworks_dir)
  Pod::UI.puts "[PresageVitals] Downloading SmartSpectra #{smart_spectra_version}"
  system('curl', '-fsSL', '--retry', '3', '-o', zip_path, url) or raise "[PresageVitals] Couldn't download #{url}"
  actual = Digest::SHA256.file(zip_path).hexdigest
  unless actual == smart_spectra_sha256
    FileUtils.rm_rf(frameworks_dir)
    raise "[PresageVitals] SmartSpectra checksum mismatch: expected #{smart_spectra_sha256}, got #{actual}"
  end
  system('unzip', '-q', zip_path, '-d', frameworks_dir) or raise '[PresageVitals] Couldn\'t unzip SmartSpectra'
  FileUtils.rm_f(zip_path)
  File.write(stamp_path, smart_spectra_version)
end

Pod::Spec.new do |s|
  s.name           = 'PresageVitals'
  s.version        = '0.1.0'
  s.summary        = 'SmartSpectra recovery check for Setnote'
  s.description    = 'Camera-based pulse, breathing and HRV readings from the Presage SmartSpectra SDK.'
  s.license        = 'MIT'
  s.author         = 'Setnote'
  s.homepage       = 'https://github.com/vickywane/setnote'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/vickywane/setnote.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  s.vendored_frameworks = 'Frameworks/SmartSpectra.xcframework'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
