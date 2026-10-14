require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeAirdrop"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "12.4" }
  s.source       = { :git => package["repository"]["url"], :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m}"
  # Only the React-free header is public, so Swift can `import ReactNativeAirdrop`.
  s.public_header_files = "ios/RNAirdrop.h"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
  s.frameworks = "Security"

  s.dependency "React-Core"
end
